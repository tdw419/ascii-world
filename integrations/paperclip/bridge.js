// paperclip-bridge.js - Bidirectional bridge between ASCII World and Paperclip
//
// Polls Paperclip REST API for state, renders it as .ascii dashboard.
// Processes ASCII button clicks into Paperclip API actions.
//
// Paperclip runs at http://localhost:3100 in local_trusted mode (no auth needed).

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { computeContentHash, updateHash, extractHash } from '../../sync/hash-utils.js';

const DATA_DIR = process.env.DATA_DIR || path.join(import.meta.dirname, '../../data');
const PAPERCLIP_URL = process.env.PAPERCLIP_URL || 'http://localhost:3100';
const ASCII_FILE = path.join(DATA_DIR, 'paperclip.ascii');
const POLL_INTERVAL_MS = 5000;
const GLYPHLANG_DIR = process.env.GLYPHLANG_DIR || path.join(process.env.HOME, 'zion/projects/glyphlang');
const LEARNINGS_FILE = path.join(GLYPHLANG_DIR, 'openspec/learnings.md');
const AIPM_CMD = process.env.AIPM_CMD || 'aipm';

// Multi-company selector state (persists across polls within a session)
let selectedCompanyIndex = 0;

// ---------------------------------------------------------------------------
// Paperclip API client
// ---------------------------------------------------------------------------

async function api(endpoint, opts = {}) {
    const url = `${PAPERCLIP_URL}/api${endpoint}`;
    try {
        const res = await fetch(url, {
            method: opts.method || 'GET',
            headers: { 'Content-Type': 'application/json', ...opts.headers },
            body: opts.body ? JSON.stringify(opts.body) : undefined,
        });
        if (!res.ok) {
            const text = await res.text();
            console.error(`Paperclip API ${res.status}: ${text}`);
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error(`Paperclip API error [${url}]: ${err.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// State fetcher
// ---------------------------------------------------------------------------

async function fetchPaperclipState() {
    const [health, companies] = await Promise.all([
        api('/health'),
        api('/companies'),
    ]);

    if (!companies || companies.length === 0) {
        return { health, companies: [], companyId: null, agents: [], issues: [], projects: [], dashboard: null };
    }

    // Use selected company index (clamped to valid range)
    const idx = Math.min(selectedCompanyIndex, companies.length - 1);
    const companyId = companies[idx].id;
    const [agents, issues, projects, dashboard] = await Promise.all([
        api(`/companies/${companyId}/agents`),
        api(`/companies/${companyId}/issues`),
        api(`/companies/${companyId}/projects`),
        api(`/companies/${companyId}/dashboard`),
    ]);

    return { health, companies, companyId, agents: agents || [], issues: issues || [], projects: projects || [], dashboard };
}

// ---------------------------------------------------------------------------
// Benchmark data reader - parses openspec/learnings.md
// ---------------------------------------------------------------------------

function parseLearningsMd(content) {
    if (!content) return { rows: [], lastRun: null, lastSha: null };

    const rows = [];
    let lastRun = null;
    let lastSha = null;

    for (const line of content.split('\n')) {
        // Match: | 2026-04-03T15:40:14Z | 76f8c70 | parse | 2.0 | 0.0 | 36.0 | 100 | - |
        const m = line.match(/^\|\s*([\d-]+T[\d:]+Z?)\s*\|\s*(\w+)\s*\|\s*(\w+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*(\d+)\s*\|/);
        if (m) {
            const row = {
                timestamp: m[1],
                sha: m[2],
                benchmark: m[3],
                avg_us: parseFloat(m[4]),
                min_us: parseFloat(m[5]),
                max_us: parseFloat(m[6]),
                iterations: parseInt(m[7]),
            };
            rows.push(row);
            if (!lastRun || row.timestamp >= lastRun) {
                lastRun = row.timestamp;
                lastSha = row.sha;
            }
        }
    }

    return { rows, lastRun, lastSha };
}

async function fetchBenchmarkData() {
    try {
        const content = await fs.readFile(LEARNINGS_FILE, 'utf-8');
        const { rows, lastRun, lastSha } = parseLearningsMd(content);
        if (rows.length === 0) return null;

        // Get latest result per benchmark
        const latest = {};
        const previous = {};
        // Sort rows by timestamp to get ordering
        const sorted = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        for (const r of sorted) {
            if (latest[r.benchmark] && latest[r.benchmark].timestamp === lastRun) {
                // Already have latest for this benchmark, track previous
                if (!previous[r.benchmark] || r.timestamp > previous[r.benchmark].timestamp) {
                    if (r.timestamp !== lastRun) previous[r.benchmark] = r;
                }
            } else {
                if (latest[r.benchmark] && r.timestamp > latest[r.benchmark].timestamp) {
                    previous[r.benchmark] = latest[r.benchmark];
                }
                latest[r.benchmark] = r;
            }
        }

        // Calculate trends
        const benchmarks = [];
        for (const [name, data] of Object.entries(latest)) {
            const prev = previous[name];
            let trend = null;
            if (prev) {
                const delta = data.avg_us - prev.avg_us;
                const pct = prev.avg_us > 0 ? Math.round((delta / prev.avg_us) * 100) : 0;
                if (Math.abs(delta) < 0.5) trend = { symbol: '~', delta: 0, pct: 0 };
                else if (delta > 0) trend = { symbol: '▲', delta, pct };
                else trend = { symbol: '▼', delta, pct };
            }
            benchmarks.push({ name, ...data, trend });
        }

        // Sort by avg descending (slowest first)
        benchmarks.sort((a, b) => b.avg_us - a.avg_us);

        const slowest = benchmarks[0]?.name || '-';

        return { benchmarks, lastRun, lastSha, slowest };
    } catch (err) {
        console.error(`[bench] error reading learnings: ${err.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// OpenSpec state reader - reads state.json from project workspaces
// ---------------------------------------------------------------------------

async function fetchOpenSpecData(projects) {
    const results = [];
    const seen = new Set();
    for (const p of projects) {
        // Check both effectiveLocalFolder (resolved workspace) and localFolder (user-configured)
        const folders = [
            p.codebase?.effectiveLocalFolder,
            p.codebase?.localFolder,
        ].filter(Boolean);

        for (const folder of folders) {
            if (seen.has(folder)) continue;
            seen.add(folder);

            const openspecDir = path.join(folder, 'openspec', 'changes');
            let changeDirs;
            try {
                changeDirs = await fs.readdir(openspecDir);
            } catch {
                continue; // No openspec dir for this project
            }

            for (const slug of changeDirs) {
                const statePath = path.join(openspecDir, slug, 'state.json');
                let stateData;
                try {
                    const raw = await fs.readFile(statePath, 'utf-8');
                    stateData = JSON.parse(raw);
                } catch {
                    continue;
                }

                // Count step statuses
                let done = 0, pending = 0, failed = 0, total = 0;
                for (const [stepId, stepState] of Object.entries(stateData)) {
                    total++;
                    const status = typeof stepState === 'string' ? stepState : stepState?.status || 'pending';
                    if (status === 'done') done++;
                    else if (status === 'failed') failed++;
                    else pending++;
                }

                // Read proposal title
                let title = slug;
                try {
                    const proposal = await fs.readFile(path.join(openspecDir, slug, 'proposal.md'), 'utf-8');
                    const titleMatch = proposal.match(/^#\s+(.+)/m);
                    if (titleMatch) title = titleMatch[1].slice(0, 40);
                } catch { /* use slug */ }

                const changeKey = `${p.name}/${slug}`;
                if (!results.find(r => r.slug === slug && r.project === p.name)) {
                    results.push({ slug, title, total, done, pending, failed, project: p.name });
                }
            }
        }
    }
    return results;
}

// ---------------------------------------------------------------------------
// ASCII renderer
// ---------------------------------------------------------------------------

function statusSymbol(status) {
    const map = {
        idle: '○', running: '●', paused: '◐', error: '◉',
        active: '●', in_progress: '◐', done: '✓',
        todo: '○', in_progress: '◐', blocked: '◉', completed: '●',
        cancelled: '✗',
    };
    return map[status] || '○';
}

function priorityBadge(p) {
    return { high: '↑', medium: '→', low: '↓' }[p] || '→';
}

function truncate(s, len) {
    if (!s) return '';
    return s.length > len ? s.slice(0, len - 1) + '…' : s;
}

function pad(s, len) {
    return (s || '').padEnd(len);
}

function progressbar(done, total, width) {
    if (total === 0) return '░'.repeat(width);
    const filled = Math.round((done / total) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function renderDashboard(state, benchData = null, openspecData = null) {
    const { health, companies, agents, issues, projects, dashboard } = state;
    const company = companies[selectedCompanyIndex] || companies[0];
    const companyName = company ? company.name : 'No Company';
    const prefix = company ? company.issuePrefix : '???';

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const db = dashboard || {};

    const lines = [];

    // Header
    lines.push(`╔══════════════════════════════════════════════════════════════╗`);
    lines.push(`║  PAPERCLIP — ${pad(companyName, 31)}ver:--------  ║`);
    lines.push(`╠══════════════════════════════════════════════════════════════╣`);

    // Company selector (if multiple companies)
    if (companies.length > 1) {
        const companyList = companies.map((c, i) => {
            const marker = i === selectedCompanyIndex ? '►' : ' ';
            return `${marker}${c.name}`;
        }).join('  ');
        lines.push(`║  [<] Prev  [>] Next  ${truncate(companyList, 38)}  ║`);
        lines.push(`╠══════════════════════════════════════════════════════════════╣`);
    }

    // Navigation
    lines.push(`║  [1] Dashboard  [2] Agents  [3] Issues  [4] Projects  [R] Refresh  ║`);
    lines.push(`╠══════════════════════════════════════════════════════════════╣`);

    // Health bar
    const statusStr = health?.status === 'ok' ? '● online' : '◉ offline';
    const versionStr = health?.version || '?';
    lines.push(`║  Server ${statusStr}  v${versionStr}  ${now}                ║`);
    lines.push(`║                                                              ║`);

    // Dashboard stats
    if (db.agents || db.tasks) {
        lines.push(`║  ┌─ Overview ──────────────────────────────────────────────┐   ║`);
        const ag = db.agents || {};
        const tk = db.tasks || {};
        const co = db.costs || {};
        lines.push(`║  │  Agents: ${String(ag.active || 0).padStart(2)} active   ${String(ag.running || 0).padStart(2)} running   ${String(ag.paused || 0).padStart(2)} paused    │   ║`);
        lines.push(`║  │  Issues: ${String(tk.open || 0).padStart(2)} open     ${String(tk.inProgress || 0).padStart(2)} active     ${String(tk.done || 0).padStart(2)} done      │   ║`);
        const spent = ((co.monthSpendCents || 0) / 100).toFixed(2);
        const budget = ((co.monthBudgetCents || 0) / 100).toFixed(2);
        lines.push(`║  │  Cost:   $${spent.padStart(8)} / $${budget.padStart(8)}                  │   ║`);
        lines.push(`║  └──────────────────────────────────────────────────────────┘   ║`);
        lines.push(`║                                                              ║`);
    }

    // Agents table
    if (agents.length > 0) {
        lines.push(`║  ┌─ Agents ────────────────────────────────────────────────┐   ║`);
        lines.push(`║  │  Key  Role        Name         Status      Adapter      │   ║`);
        lines.push(`║  │  ───  ──────────  ───────────  ──────────  ───────────  │   ║`);
        agents.forEach((agent, i) => {
            const key = String.fromCharCode(65 + i); // A, B, C...
            const sym = statusSymbol(agent.status);
            const role = pad((agent.role || agent.name), 11);
            const name = pad(agent.name, 12);
            const status = pad(`${sym} ${agent.status}`, 11);
            const adapter = pad(truncate(agent.adapterType || '', 12), 12);
            lines.push(`║  │  [${key}]  ${role}  ${name}  ${status}  ${adapter}  │   ║`);
        });
        lines.push(`║  │                                                          │   ║`);
        lines.push(`║  │  [W] Wake CEO     [P] Pause All     [X] Refresh          │   ║`);
        lines.push(`║  └──────────────────────────────────────────────────────────┘   ║`);
        lines.push(`║                                                              ║`);
    }

    // Issues table
    if (issues.length > 0) {
        lines.push(`║  ┌─ Issues ────────────────────────────────────────────────┐   ║`);
        lines.push(`║  │  ID        Pri  Status     Title                        │   ║`);
        lines.push(`║  │  ────────  ───  ─────────  ──────────────────────────   │   ║`);
        issues.slice(0, 8).forEach((issue) => {
            const id = pad(issue.identifier || `#${issue.issueNumber}`, 9);
            const pri = priorityBadge(issue.priority);
            const sym = statusSymbol(issue.status);
            const status = pad(`${sym} ${issue.status}`, 10);
            const title = pad(truncate(issue.title, 26), 26);
            lines.push(`║  │  ${id}  ${pri}   ${status}  ${title}  │   ║`);
        });
        if (issues.length > 8) {
            lines.push(`║  │  ... and ${issues.length - 8} more                                          │   ║`);
        }
        lines.push(`║  │                                                          │   ║`);
        lines.push(`║  │  [N] New Issue   [E] Execute   [S] Start   [D] Done Next  │   ║`);
        lines.push(`║  └──────────────────────────────────────────────────────────┘   ║`);
        lines.push(`║                                                              ║`);
    }

    // Projects
    if (projects.length > 0) {
        lines.push(`║  ┌─ Projects ──────────────────────────────────────────────┐   ║`);
        projects.forEach((p) => {
            const sym = statusSymbol(p.status);
            const name = pad(p.name, 24);
            const status = pad(`${sym} ${p.status}`, 16);
            lines.push(`║  │  ${name}  ${status}              │   ║`);
        });
        lines.push(`║  └──────────────────────────────────────────────────────────┘   ║`);
        lines.push(`║                                                              ║`);
    }

    // OpenSpec changes (from project workspaces)
    if (openspecData && openspecData.length > 0) {
        lines.push(`║  ┌─ OpenSpec Changes ─────────────────────────────────────┐   ║`);
        lines.push(`║  │  Change                       Done/Total  Pending  Flr │   ║`);
        lines.push(`║  │  ────────────────────────────  ─────────  ──────  ─── │   ║`);
        openspecData.slice(0, 6).forEach((change) => {
            const bar = progressbar(change.done, change.total, 10);
            const name = pad(truncate(change.slug, 28), 28);
            const progress = `${String(change.done).padStart(2)}/${String(change.total).padStart(2)}`;
            const pending = String(change.pending).padStart(6);
            const failed = String(change.failed).padStart(3);
            lines.push(`║  │  ${name}  ${progress}  ${bar}  ${pending}  ${failed} │   ║`);
        });
        lines.push(`║  │                                                          │   ║`);
        lines.push(`║  │  [E] Execute Step  [O] Wake CEO to Scan                  │   ║`);
        lines.push(`║  └──────────────────────────────────────────────────────────┘   ║`);
        lines.push(`║                                                              ║`);
    }

    // Benchmarks (from learnings.md)
    if (benchData && benchData.benchmarks.length > 0) {
        const runTime = benchData.lastRun ? benchData.lastRun.replace('T', ' ').replace('Z', '') : '?';
        const sha = benchData.lastSha || '?';
        lines.push(`║  ┌─ Benchmarks (last: ${pad(runTime, 19)} sha:${pad(sha, 7)}) ──┐   ║`);
        lines.push(`║  │  Pipeline            Avg      Min      Max    Trend     │   ║`);
        lines.push(`║  │  ──────────          ─────    ─────    ─────  ─────     │   ║`);
        benchData.benchmarks.slice(0, 6).forEach((b) => {
            const name = pad(b.name, 18);
            const avg = `${b.avg_us.toFixed(1)}us`.padStart(8);
            const min = `${b.min_us.toFixed(1)}us`.padStart(8);
            const max = `${b.max_us.toFixed(1)}us`.padStart(8);
            let trend = '  -';
            if (b.trend) {
                const pct = Math.abs(b.trend.pct);
                if (b.trend.symbol === '▲') trend = ` ▲${pct}%`;
                else if (b.trend.symbol === '▼') trend = ` ▼${pct}%`;
                else trend = '  ~';
            }
            trend = pad(trend, 6);
            lines.push(`║  │  ${name}${avg}${min}${max}  ${trend}  │   ║`);
        });
        lines.push(`║  │                                                          │   ║`);
        lines.push(`║  │  Slowest: ${pad(benchData.slowest, 18)}                         │   ║`);
        lines.push(`║  │                                                          │   ║`);
        lines.push(`║  │  [B] Run Bench   [T] Strategist   [F] Full Cycle        │   ║`);
        lines.push(`║  └──────────────────────────────────────────────────────────┘   ║`);
        lines.push(`║                                                              ║`);
    } else {
        lines.push(`║  ┌─ Benchmarks ────────────────────────────────────────────┐   ║`);
        lines.push(`║  │  No benchmark data found                                 │   ║`);
        lines.push(`║  │  Run: glyph bench --persist                               │   ║`);
        lines.push(`║  │                                                          │   ║`);
        lines.push(`║  │  [B] Run Bench   [T] Strategist   [F] Full Cycle        │   ║`);
        lines.push(`║  └──────────────────────────────────────────────────────────┘   ║`);
        lines.push(`║                                                              ║`);
    }

    // Footer
    lines.push(`╠══════════════════════════════════════════════════════════════╣`);
    lines.push(`║  Actions: Click buttons above  |  Auto-refresh every 5s      ║`);
    lines.push(`╚══════════════════════════════════════════════════════════════╝`);

    let content = lines.join('\n') + '\n';
    content = updateHash(content);
    return content;
}

// ---------------------------------------------------------------------------
// Action handler - processes ASCII button clicks into Paperclip API calls
// ---------------------------------------------------------------------------

export async function handlePaperclipAction(content, action) {
    const key = (action.key || '').toUpperCase();
    const label = (action.label || '').toLowerCase();
    const changes = [];

    // Company selector: [<] prev, [>] next
    if (key === '<' || label.includes('prev')) {
        const state = await fetchPaperclipState();
        if (state.companies.length > 1) {
            selectedCompanyIndex = (selectedCompanyIndex - 1 + state.companies.length) % state.companies.length;
            changes.push(`Switched to company: ${state.companies[selectedCompanyIndex].name}`);
        }
    }
    if (key === '>' || label.includes('next company')) {
        const state = await fetchPaperclipState();
        if (state.companies.length > 1) {
            selectedCompanyIndex = (selectedCompanyIndex + 1) % state.companies.length;
            changes.push(`Switched to company: ${state.companies[selectedCompanyIndex].name}`);
        }
    }

    // Wake CEO (or agent by key)
    if (key === 'W' || label.includes('wake')) {
        const state = await fetchPaperclipState();
        if (state.agents.length > 0) {
            const agent = state.agents[0]; // CEO
            const result = await api(`/agents/${agent.id}/wakeup`, { method: 'POST', body: {} });
            if (result) {
                changes.push(`Woke agent ${agent.name} (${agent.role})`);
            } else {
                changes.push(`Failed to wake ${agent.name}`);
            }
        }
    }

    // Pause all agents
    if (key === 'P' || label.includes('pause all')) {
        const state = await fetchPaperclipState();
        for (const agent of state.agents) {
            await api(`/agents/${agent.id}`, {
                method: 'PATCH',
                body: { status: 'paused' },
            });
            changes.push(`Paused ${agent.name}`);
        }
    }

    // Refresh - just re-fetch
    if (key === 'R' || key === 'X' || label.includes('refresh')) {
        changes.push('Refreshed state from Paperclip');
    }

    // Start next issue (checkout first todo issue)
    if (key === 'S' || label.includes('start next')) {
        const state = await fetchPaperclipState();
        const todo = state.issues.find(i => i.status === 'todo');
        if (todo) {
            const agent = state.agents[0];
            const result = await api(`/issues/${todo.id}/checkout`, {
                method: 'POST',
                body: {
                    agentId: agent?.id,
                    priority: todo.priority,
                },
            });
            if (result) {
                changes.push(`Checked out ${todo.identifier}: ${todo.title}`);
            } else {
                changes.push(`Failed to checkout ${todo.identifier}`);
            }
        } else {
            changes.push('No todo issues to start');
        }
    }

    // Mark next in-progress issue as done
    if (key === 'D' || label.includes('done next')) {
        const state = await fetchPaperclipState();
        const inProg = state.issues.find(i => i.status === 'in_progress');
        if (inProg) {
            const result = await api(`/issues/${inProg.id}`, {
                method: 'PATCH',
                body: { status: 'completed' },
            });
            if (result) {
                changes.push(`Completed ${inProg.identifier}: ${inProg.title}`);
            }
        } else {
            changes.push('No in-progress issues to complete');
        }
    }

    // [B] Run Benchmarks - execute `glyph bench --persist` in glyphlang dir
    if (key === 'B' || label.includes('run bench')) {
        try {
            const out = execSync('go run ./cmd/glyph bench --persist', {
                cwd: GLYPHLANG_DIR,
                timeout: 120000,
                encoding: 'utf-8',
            });
            const lines = out.trim().split('\n');
            const lastLine = lines[lines.length - 1] || 'done';
            changes.push(`Benchmarks ran: ${lastLine.slice(0, 60)}`);
        } catch (err) {
            changes.push(`Benchmark error: ${err.message.slice(0, 60)}`);
        }
    }

    // [T] Run Strategist - execute auto_strategist.py
    if (key === 'T' || label.includes('strategist')) {
        try {
            const out = execSync('python3 scripts/auto_strategist.py', {
                cwd: GLYPHLANG_DIR,
                timeout: 60000,
                encoding: 'utf-8',
            });
            const lines = out.trim().split('\n');
            const created = lines.find(l => l.includes('Created Paperclip issue'));
            changes.push(created || 'Strategist ran');
        } catch (err) {
            changes.push(`Strategist error: ${err.message.slice(0, 60)}`);
        }
    }

    // [F] Full Cycle - Bench + Strategist
    if (key === 'F' || label.includes('full cycle')) {
        try {
            const benchOut = execSync('go run ./cmd/glyph bench --persist', {
                cwd: GLYPHLANG_DIR,
                timeout: 120000,
                encoding: 'utf-8',
            });
            changes.push('Benchmarks complete');
        } catch (err) {
            changes.push(`Benchmark error: ${err.message.slice(0, 50)}`);
        }
        try {
            const stratOut = execSync('python3 scripts/auto_strategist.py', {
                cwd: GLYPHLANG_DIR,
                timeout: 60000,
                encoding: 'utf-8',
            });
            const lines = stratOut.trim().split('\n');
            const created = lines.find(l => l.includes('Created Paperclip issue'));
            changes.push(created || 'Strategist complete');
        } catch (err) {
            changes.push(`Strategist error: ${err.message.slice(0, 50)}`);
        }
    }

    // [E] Execute Step - find first issue with OpenSpec context and run aipm execute-step
    if (key === 'E' || label.includes('execute')) {
        const state = await fetchPaperclipState();
        // Find the first todo or in_progress issue that has OpenSpec context in its description
        const target = state.issues.find(i =>
            (i.status === 'todo' || i.status === 'in_progress') &&
            i.description &&
            (i.description.includes('Step ID:') || i.description.includes('--step-id') || i.description.includes('change-dir'))
        );
        if (target) {
            // Extract step context from the issue description
            const desc = target.description || '';
            const stepMatch = desc.match(/Step ID:\s*`?([\d.]+)`?/i) || desc.match(/--step-id\s+(\S+)/);
            const changeMatch = desc.match(/Change directory:\s*`?([^\s`\n]+)`?/i) || desc.match(/--change-dir\s+(\S+)/);
            const workdirMatch = desc.match(/Workdir:\s*`?([^\s`\n]+)`?/i) || desc.match(/--workdir\s+(\S+)/);

            if (stepMatch && changeMatch) {
                const stepId = stepMatch[1];
                const changeDir = changeMatch[1];
                const workdir = workdirMatch ? workdirMatch[1] : path.dirname(path.dirname(changeDir));

                // Check out the issue first if it's still todo
                if (target.status === 'todo') {
                    const engineer = state.agents.find(a => a.role === 'engineer' && a.status !== 'paused');
                    await api(`/issues/${target.id}/checkout`, {
                        method: 'POST',
                        body: { agentId: engineer?.id },
                    });
                }

                try {
                    const cmd = `${AIPM_CMD} execute-step --change-dir "${changeDir}" --step-id "${stepId}" --workdir "${workdir}"`;
                    const out = execSync(cmd, {
                        timeout: 600000, // 10 minutes max
                        encoding: 'utf-8',
                    });
                    // Parse the JSON result from the last line
                    const lastLine = out.trim().split('\n').pop();
                    try {
                        const result = JSON.parse(lastLine);
                        if (result.status === 'done') {
                            // Mark the Paperclip issue as completed
                            await api(`/issues/${target.id}`, {
                                method: 'PATCH',
                                body: { status: 'completed' },
                            });
                            changes.push(`Step ${stepId} done. Tests: ${result.tests}. Commit: ${result.commit}`);
                        } else {
                            changes.push(`Step ${stepId}: ${result.status}. Error: ${(result.error || '').slice(0, 50)}`);
                        }
                    } catch {
                        changes.push(`Step ${stepId} executed. Output: ${lastLine.slice(0, 60)}`);
                    }
                } catch (err) {
                    const stderr = err.stderr?.toString() || err.message;
                    // Try to parse JSON from stderr (failures go to stderr)
                    const errLines = stderr.trim().split('\n');
                    const errJson = errLines.find(l => l.startsWith('{'));
                    if (errJson) {
                        try {
                            const result = JSON.parse(errJson);
                            changes.push(`Step ${stepId} FAILED: ${(result.error || '').slice(0, 60)}`);
                        } catch {
                            changes.push(`Step ${stepId} error: ${stderr.slice(0, 60)}`);
                        }
                    } else {
                        changes.push(`Execute error: ${err.message.slice(0, 60)}`);
                    }
                    // Mark issue as blocked
                    await api(`/issues/${target.id}`, {
                        method: 'PATCH',
                        body: { status: 'blocked' },
                    });
                }
            } else {
                changes.push(`Issue ${target.identifier} has OpenSpec context but couldn't extract step-id/change-dir`);
            }
        } else {
            changes.push('No issues with OpenSpec step context found');
        }
    }

    // [O] Wake CEO to Scan OpenSpec - trigger CEO heartbeat to create new issues
    if (key === 'O' || label.includes('wake ceo to scan')) {
        const state = await fetchPaperclipState();
        const ceo = state.agents.find(a => a.role === 'ceo');
        if (ceo) {
            const result = await api(`/agents/${ceo.id}/wakeup`, { method: 'POST', body: {} });
            changes.push(result ? `Woke CEO ${ceo.name} to scan OpenSpec` : `Failed to wake CEO`);
        } else {
            changes.push('No CEO agent found in this company');
        }
    }

    // [C] Completion Feedback - run post-completion bench on most recently completed issue
    if (key === 'C' || label.includes('completion feedback')) {
        const state = await fetchPaperclipState();
        // Find the most recently completed issue
        const completed = state.issues
            .filter(i => i.status === 'done' || i.status === 'completed')
            .sort((a, b) => (b.completedAt || b.updatedAt || '').localeCompare(a.completedAt || a.updatedAt || ''));
        if (completed.length > 0) {
            const target = completed[0];
            changes.push(`Running completion feedback for ${target.identifier}...`);
            try {
                const out = execSync(
                    `python3 scripts/post_completion_bench.py ${target.id}`,
                    { cwd: GLYPHLANG_DIR, timeout: 180000, encoding: 'utf-8' },
                );
                changes.push(`Benchmark feedback posted to ${target.identifier}`);
            } catch (err) {
                if (err.status === 2) {
                    changes.push(`REGRESSIONS detected for ${target.identifier}! Check comments.`);
                } else {
                    changes.push(`Feedback error: ${err.message.slice(0, 50)}`);
                }
            }
        } else {
            changes.push('No completed issues to analyze');
        }
    }

    // Wake agent by letter key (A=first, B=second, etc.)
    if (/^[A-Z]$/.test(key) && !['W','P','R','X','S','D','N','B','T','F','E','O','C'].includes(key)) {
        const idx = key.charCodeAt(0) - 65;
        const state = await fetchPaperclipState();
        if (state.agents[idx]) {
            const agent = state.agents[idx];
            const result = await api(`/agents/${agent.id}/wakeup`, { method: 'POST', body: {} });
            changes.push(result ? `Woke ${agent.name}` : `Failed to wake ${agent.name}`);
        }
    }

    // Re-render with fresh state after action
    const freshState = await fetchPaperclipState();
    const freshBench = await fetchBenchmarkData();
    const freshOpenspec = await fetchOpenSpecData(freshState.projects);
    let newContent = renderDashboard(freshState, freshBench, freshOpenspec);

    return { content: newContent, changes, newHash: extractHash(newContent) };
}

// ---------------------------------------------------------------------------
// Sync integration - called by sync-server for paperclip.ascii actions
// ---------------------------------------------------------------------------

// Register a custom action handler name
export const PAPERCLIP_ACTION_TYPE = 'paperclip_action';

// ---------------------------------------------------------------------------
// Poll loop - continuously updates paperclip.ascii with live state
// ---------------------------------------------------------------------------

let pollTimer = null;
let previousIssueStatuses = new Map(); // issueId -> status (for completion detection)

export async function startPaperclipPoller(onUpdate) {
    console.log(`Starting Paperclip poller (every ${POLL_INTERVAL_MS}ms)`);

    // Initial fetch
    await pollAndUpdate(onUpdate);

    // Poll loop
    pollTimer = setInterval(async () => {
        await pollAndUpdate(onUpdate);
    }, POLL_INTERVAL_MS);
}

export function stopPaperclipPoller() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        console.log('Paperclip poller stopped');
    }
}

async function pollAndUpdate(onUpdate) {
    try {
        const state = await fetchPaperclipState();
        const benchData = await fetchBenchmarkData();
        const openspecData = await fetchOpenSpecData(state.projects);

        // Detect issue completions
        const newlyCompleted = [];
        for (const issue of state.issues) {
            const prevStatus = previousIssueStatuses.get(issue.id);
            const curStatus = issue.status;
            previousIssueStatuses.set(issue.id, curStatus);

            // Detect transition to done/completed from in_progress/todo
            if ((curStatus === 'done' || curStatus === 'completed') &&
                prevStatus && prevStatus !== 'done' && prevStatus !== 'completed') {
                newlyCompleted.push(issue);
            }
        }

        // Run post-completion benchmark for each newly completed issue
        for (const issue of newlyCompleted) {
            console.log(`[feedback] Issue ${issue.identifier} completed (${issue.title.slice(0, 50)}), running post-completion bench...`);
            try {
                const out = execSync(
                    `python3 scripts/post_completion_bench.py ${issue.id}`,
                    { cwd: GLYPHLANG_DIR, timeout: 180000, encoding: 'utf-8' },
                );
                console.log(`[feedback] Post-completion bench done for ${issue.identifier}`);
            } catch (err) {
                // exit code 2 = regressions found (that's fine, still posted the comment)
                // other exit codes = actual error
                if (err.status === 2) {
                    console.log(`[feedback] Post-completion bench for ${issue.identifier}: REGRESSIONS DETECTED`);
                } else {
                    console.error(`[feedback] Post-completion bench error for ${issue.identifier}: ${err.message}`);
                }
            }
        }

        const newContent = renderDashboard(state, benchData, openspecData);

        // Check if content actually changed
        const currentContent = await fs.readFile(ASCII_FILE, 'utf-8').catch(() => '');
        const currentHash = extractHash(currentContent);
        const newHash = extractHash(newContent);

        if (currentHash !== newHash) {
            await fs.writeFile(ASCII_FILE, newContent, 'utf-8');
            if (onUpdate) {
                onUpdate(ASCII_FILE, newContent, newHash);
            }
        }
    } catch (err) {
        console.error('Paperclip poll error:', err.message);
    }
}

// ---------------------------------------------------------------------------
// CLI: run standalone to generate .ascii file once
// ---------------------------------------------------------------------------

// If run directly (not imported), generate once
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
    const cmd = process.argv[2];
    if (cmd === 'poll') {
        startPaperclipPoller((filepath, content, hash) => {
            console.log(`Updated ${path.basename(filepath)} hash=${hash}`);
        });
        console.log('Polling... Ctrl+C to stop');
    } else {
        // One-shot render
        Promise.all([fetchPaperclipState(), fetchBenchmarkData()]).then(async ([state, benchData]) => {
            const openspecData = await fetchOpenSpecData(state.projects);
            const content = renderDashboard(state, benchData, openspecData);
            fsSync.mkdirSync(DATA_DIR, { recursive: true });
            fsSync.writeFileSync(ASCII_FILE, content, 'utf-8');
            console.log(`Wrote ${ASCII_FILE}`);
            console.log(content);
        });
    }
}
