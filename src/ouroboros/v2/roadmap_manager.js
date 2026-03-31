#!/usr/bin/env node
/**
 * Roadmap Manager - Strategic Planning for Ouroboros V2
 * 
 * Reads and maintains ROADMAP.md to guide the AI agent through
 * strategic phases instead of reactive hill-climbing.
 * 
 * Usage:
 *   node roadmap_manager.js status          - Show current phase
 *   node roadmap_manager.js next            - Get next milestone
 *   node roadmap_manager.js complete <id>   - Mark milestone complete
 *   node roadmap_manager.js metrics         - Show metrics
 *   node roadmap_manager.js update          - Update metrics in roadmap
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const PROJECT_ROOT = '/home/jericho/zion/projects/ascii_world/ascii_world';
const ROADMAP_FILE = join(PROJECT_ROOT, 'ROADMAP.md');

class RoadmapManager {
    constructor() {
        this.roadmap = this.parseRoadmap();
    }

    parseRoadmap() {
        if (!existsSync(ROADMAP_FILE)) {
            return this.createDefaultRoadmap();
        }

        const content = readFileSync(ROADMAP_FILE, 'utf-8');
        
        const roadmap = {
            phases: [],
            currentPhase: null,
            metrics: {},
            decisions: [],
            version: '1.0'
        };

        // Parse phases
        const phaseRegex = /### (Phase \d+): (.+?) ([✅🔄⏸️❌])/g;
        let match;
        while ((match = phaseRegex.exec(content)) !== null) {
            const [, id, name, statusEmoji] = match;
            const status = this.emojiToStatus(statusEmoji);
            
            // Extract milestones for this phase
            const phaseStart = content.indexOf(match[0]);
            const nextPhase = content.indexOf('### Phase', phaseStart + 1);
            const phaseContent = content.slice(phaseStart, nextPhase === -1 ? undefined : nextPhase);
            
            const milestones = [];
            const milestoneRegex = /- \[([ x])\] (.+)/g;
            let mMatch;
            while ((mMatch = milestoneRegex.exec(phaseContent)) !== null) {
                milestones.push({
                    text: mMatch[2],
                    complete: mMatch[1] === 'x'
                });
            }

            const phase = { id, name, status, milestones };
            roadmap.phases.push(phase);
            
            if (status === 'in_progress') {
                roadmap.currentPhase = phase;
            }
        }

        // Parse metrics
        const metricsRegex = /\| (Tests|Coverage|Modules|Documentation) \| ([\d.~%]+) \| ([\d.~%]+) \| ([\d.~%]+) \|/g;
        while ((match = metricsRegex.exec(content)) !== null) {
            const [, name, start, current, target] = match;
            roadmap.metrics[name.toLowerCase()] = {
                start: this.parseMetric(start),
                current: this.parseMetric(current),
                target: this.parseMetric(target)
            };
        }

        return roadmap;
    }

    emojiToStatus(emoji) {
        const map = {
            '✅': 'complete',
            '🔄': 'in_progress',
            '⏸️': 'paused',
            '❌': 'blocked'
        };
        return map[emoji] || 'pending';
    }

    statusToEmoji(status) {
        const map = {
            'complete': '✅',
            'in_progress': '🔄',
            'pending': '⏸️',
            'blocked': '❌'
        };
        return map[status] || '⏸️';
    }

    parseMetric(value) {
        return value.replace(/[~%]/g, '').trim();
    }

    getCurrentPhase() {
        return this.roadmap.currentPhase || this.roadmap.phases.find(p => p.status !== 'complete');
    }

    getNextMilestone() {
        const phase = this.getCurrentPhase();
        if (!phase) return null;
        
        const incomplete = phase.milestones.filter(m => !m.complete);
        return incomplete[0] || null;
    }

    getProgress() {
        const total = this.roadmap.phases.reduce((sum, p) => sum + p.milestones.length, 0);
        const complete = this.roadmap.phases.reduce((sum, p) => 
            sum + p.milestones.filter(m => m.complete).length, 0);
        
        return {
            total,
            complete,
            percentage: Math.round((complete / total) * 100)
        };
    }

    getRecommendedAction() {
        const phase = this.getCurrentPhase();
        if (!phase) {
            return { action: 'complete', message: 'All phases complete!' };
        }

        const milestone = this.getNextMilestone();
        if (!milestone) {
            return { 
                action: 'advance_phase', 
                message: `Phase ${phase.id} complete. Advance to next phase.` 
            };
        }

        // Phase-specific recommendations
        if (phase.id === 'Phase 2') {
            return {
                action: 'improve_coverage',
                message: `Focus: ${milestone.text}`,
                details: 'Run tests with coverage, identify gaps, add tests'
            };
        }

        return {
            action: 'complete_milestone',
            message: milestone.text,
            phase: phase.id
        };
    }

    updateMetrics(metrics) {
        for (const [key, value] of Object.entries(metrics)) {
            if (this.roadmap.metrics[key]) {
                this.roadmap.metrics[key].current = value;
            }
        }
    }

    render() {
        const lines = [];

        lines.push('# Ouroboros V2 Roadmap');
        lines.push('');
        lines.push('This roadmap guides the autonomous AI agent through strategic phases of codebase improvement.');
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## Current Goal');
        lines.push('**Target:** 400+ tests passing with >50% coverage on all core modules');
        lines.push('');
        lines.push('---');
        lines.push('');
        lines.push('## Phases');
        lines.push('');

        for (const phase of this.roadmap.phases) {
            const emoji = this.statusToEmoji(phase.status);
            lines.push(`### ${phase.id}: ${phase.name} ${emoji}`);
            lines.push(`**Status:** ${phase.status.toUpperCase()}`);
            lines.push('**Milestones:**');
            
            for (const m of phase.milestones) {
                const check = m.complete ? 'x' : ' ';
                lines.push(`- [${check}] ${m.text}`);
            }
            lines.push('');
        }

        lines.push('---');
        lines.push('## Metrics Tracking');
        lines.push('');
        lines.push('| Metric | Start | Current | Target |');
        lines.push('|--------|-------|---------|--------|');
        
        for (const [name, data] of Object.entries(this.roadmap.metrics)) {
            const label = name.charAt(0).toUpperCase() + name.slice(1);
            lines.push(`| ${label} | ${data.start} | ${data.current} | ${data.target} |`);
        }
        lines.push('');

        return lines.join('\n');
    }

    save() {
        writeFileSync(ROADMAP_FILE, this.render());
    }

    createDefaultRoadmap() {
        return {
            phases: [
                {
                    id: 'Phase 1',
                    name: 'Test Coverage Foundation',
                    status: 'complete',
                    milestones: [
                        { text: 'Achieve 212+ tests passing', complete: true },
                        { text: 'Add tests for all sync/*.js modules', complete: true },
                        { text: 'Establish continuous loop infrastructure', complete: true }
                    ]
                },
                {
                    id: 'Phase 2',
                    name: 'Code Quality Hardening',
                    status: 'in_progress',
                    milestones: [
                        { text: 'Increase coverage to 50% on all core modules', complete: false },
                        { text: 'Add JSDoc documentation to all public functions', complete: false },
                        { text: 'Remove dead code and unused dependencies', complete: false },
                        { text: 'Standardize error handling patterns', complete: false }
                    ]
                }
            ],
            currentPhase: null,
            metrics: {
                tests: { start: '212', current: '301', target: '400+' },
                coverage: { start: '5%', current: '35%', target: '50%+' },
                modules: { start: '17', current: '29', target: '100%' },
                documentation: { start: '0%', current: '10%', target: '80%' }
            },
            version: '1.0'
        };
    }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];
const manager = new RoadmapManager();

switch (command) {
    case 'status':
        const phase = manager.getCurrentPhase();
        const progress = manager.getProgress();
        console.log(JSON.stringify({
            currentPhase: phase?.id || 'None',
            phaseName: phase?.name || 'All complete',
            status: phase?.status || 'complete',
            progress: progress,
            nextMilestone: manager.getNextMilestone()?.text || 'None'
        }, null, 2));
        break;

    case 'next':
        const action = manager.getRecommendedAction();
        console.log(JSON.stringify(action, null, 2));
        break;

    case 'metrics':
        console.log(JSON.stringify(manager.roadmap.metrics, null, 2));
        break;

    case 'update':
        // Update metrics from test run
        const { execSync } = require('child_process');
        try {
            const result = execSync('timeout 25 node --test tests/*.test.js 2>&1', { 
                cwd: PROJECT_ROOT, 
                encoding: 'utf-8' 
            });
            const passMatch = result.match(/ℹ pass (\d+)/);
            if (passMatch) {
                manager.updateMetrics({ tests: passMatch[1] });
                manager.save();
                console.log(`Updated: ${passMatch[1]} tests passing`);
            }
        } catch (e) {
            console.log('Could not update metrics');
        }
        break;

    case 'render':
        console.log(manager.render());
        break;

    default:
        console.log(`
Roadmap Manager - Strategic Planning for Ouroboros V2

Commands:
  status    - Show current phase and progress
  next      - Get recommended next action
  metrics   - Show current metrics
  update    - Update metrics from test run
  render    - Render full roadmap markdown
`);
}
