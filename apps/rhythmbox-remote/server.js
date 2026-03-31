#!/usr/bin/env node
/**
 * Rhythmbox Remote — pxOS-style ASCII music controller
 * 
 * Architecture:
 *   - HTTP server serves the viewer HTML
 *   - WebSocket pushes real-time player state
 *   - Polling loop reads Rhythmbox via rhythmbox-client + dbus
 *   - Client button clicks → WebSocket → executes rhythmbox-client commands
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { execSync, exec } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3840;
const POLL_INTERVAL = 1000;

// ─── Rhythmbox Interface ─────────────────────────────────────────────

function rb(cmd) {
    try {
        return execSync(`rhythmbox-client ${cmd} 2>/dev/null`, { timeout: 3000 }).toString().trim();
    } catch { return ''; }
}

function dbusGet(prop) {
    try {
        const out = execSync(
            `dbus-send --print-reply --dest=org.mpris.MediaPlayer2.rhythmbox ` +
            `/org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Get ` +
            `string:"org.mpris.MediaPlayer2.Player" string:"${prop}" 2>/dev/null`,
            { timeout: 3000 }
        ).toString();
        return out;
    } catch { return ''; }
}

function getPlaylists() {
    try {
        const out = execSync(
            `dbus-send --print-reply --dest=org.mpris.MediaPlayer2.rhythmbox ` +
            `/org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Playlists.GetPlaylists ` +
            `uint32:0 uint32:100 string:"Alphabetical" boolean:false 2>/dev/null`,
            { timeout: 3000 }
        ).toString();
        const names = [];
        const paths = [];
        const lines = out.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const pathMatch = lines[i].match(/object path "([^"]+)"/);
            if (pathMatch) {
                paths.push(pathMatch[1]);
                // Next line has the name
                if (i + 1 < lines.length) {
                    const nameMatch = lines[i + 1].match(/string "([^"]*)"/);
                    if (nameMatch) {
                        names.push({ name: nameMatch[1], path: pathMatch[1] });
                    }
                }
            }
        }
        return names;
    } catch { return []; }
}

function activatePlaylist(playlistPath) {
    try {
        execSync(
            `dbus-send --print-reply --dest=org.mpris.MediaPlayer2.rhythmbox ` +
            `/org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Playlists.ActivatePlaylist ` +
            `objpath:"${playlistPath}" 2>/dev/null`,
            { timeout: 3000 }
        );
        return true;
    } catch { return false; }
}

function getState() {
    // Playing info
    const format = rb('--print-playing-format "%tt|||%ta|||%at|||%td|||%te"');
    const parts = format.split('|||');
    
    // Playback status
    const statusRaw = dbusGet('PlaybackStatus');
    let status = 'Stopped';
    if (statusRaw.includes('"Playing"')) status = 'Playing';
    else if (statusRaw.includes('"Paused"')) status = 'Paused';
    
    // Volume
    const volRaw = rb('--print-volume');
    const volMatch = volRaw.match(/([\d.]+)/);
    const volume = volMatch ? Math.round(parseFloat(volMatch[1]) * 100) : 50;

    // Position
    const posRaw = dbusGet('Position');
    const posMatch = posRaw.match(/int64\s+(\d+)/);
    const positionUs = posMatch ? parseInt(posMatch[1]) : 0;
    const positionSec = Math.floor(positionUs / 1000000);

    // Duration from metadata
    const metaRaw = dbusGet('Metadata');
    const durMatch = metaRaw.match(/mpris:length[^v]*variant\s+int64\s+(\d+)/s);
    const durationUs = durMatch ? parseInt(durMatch[1]) : 0;
    const durationSec = Math.floor(durationUs / 1000000);

    return {
        title: parts[0] || 'Nothing Playing',
        artist: parts[1] || '',
        album: parts[2] || '',
        duration: parts[3] || '0:00',
        elapsed: parts[4] || '0:00',
        status,
        volume,
        positionSec,
        durationSec,
    };
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── ASCII Renderer ──────────────────────────────────────────────────

function renderASCII(state, playlists, activePlaylist) {
    const W = 62;

    function pad(str, len) { return (str || '').slice(0, len).padEnd(len); }
    function center(str, len) {
        const s = (str || '').slice(0, len);
        const left = Math.floor((len - s.length) / 2);
        return ' '.repeat(left) + s + ' '.repeat(len - left - s.length);
    }

    // Progress bar
    const pct = state.durationSec > 0 ? state.positionSec / state.durationSec : 0;
    const barLen = 36;
    const filled = Math.round(pct * barLen);
    const bar = '▓'.repeat(filled) + '░'.repeat(barLen - filled);

    // Volume bar
    const volLen = 12;
    const volFilled = Math.round((state.volume / 100) * volLen);
    const volBar = '█'.repeat(volFilled) + '░'.repeat(volLen - volFilled);

    // Status icon
    const icon = state.status === 'Playing' ? '▶' : state.status === 'Paused' ? '⏸' : '⏹';

    // Playlist list (show max 14)
    const plMax = 14;
    const plNames = playlists.map(p => p.name).filter(n => n !== 'Play Queue');
    const plDisplay = plNames.slice(0, plMax);

    const lines = [];
    const hline = '─'.repeat(W);
    
    lines.push(`┌${hline}┐`);
    lines.push(`│${center('♪  R H Y T H M B O X   R E M O T E  ♪', W)}│`);
    lines.push(`├${hline}┤`);
    lines.push(`│  ${icon} ${pad(state.title, W - 5)}│`);
    lines.push(`│    ${pad(state.artist + (state.album ? ' — ' + state.album : ''), W - 6)}│`);
    lines.push(`│                                                              │`);
    lines.push(`│  ${bar}  ${pad(state.elapsed + ' / ' + state.duration, W - barLen - 5)}│`);
    lines.push(`│                                                              │`);
    lines.push(`│   [prev]    [play-pause]    [next]    [stop]                 │`);
    lines.push(`│                                                              │`);
    lines.push(`│   Vol: ${volBar} ${String(state.volume).padStart(3)}%   [vol-down] [vol-up]     │`);
    lines.push(`├${'─'.repeat(22)}┬${'─'.repeat(W - 23)}┤`);
    lines.push(`│ ${pad('PLAYLISTS', 20)} │ ${pad('STATUS', W - 24)}│`);
    lines.push(`├${'─'.repeat(22)}┼${'─'.repeat(W - 23)}┤`);

    for (let i = 0; i < plMax; i++) {
        const name = plDisplay[i] || '';
        const marker = (name === activePlaylist) ? '►' : ' ';
        const plCell = `${marker}${pad(name, 20)}`;
        let rightCell = '';
        if (i === 0) rightCell = `Now: ${state.status}`;
        else if (i === 1) rightCell = `Shuffle: [shuffle]`;
        else if (i === 2) rightCell = `Repeat:  [repeat]`;
        else if (i === 3) rightCell = '';
        else if (i === 4) rightCell = `Rating: [rate-1][rate-2][rate-3][rate-4][rate-5]`;
        else rightCell = '';
        
        lines.push(`│ ${plCell}│ ${pad(rightCell, W - 24)}│`);
    }

    lines.push(`├${'─'.repeat(22)}┴${'─'.repeat(W - 23)}┤`);
    lines.push(`│${center('ascii_world // pxOS — rhythmbox-remote', W)}│`);
    lines.push(`└${hline}┘`);

    return lines.join('\n');
}

// ─── Server ──────────────────────────────────────────────────────────

const clients = new Set();
let cachedState = {};
let cachedPlaylists = [];
let activePlaylist = '';

function broadcast(data) {
    const msg = JSON.stringify(data);
    for (const ws of clients) {
        if (ws.readyState === 1) ws.send(msg);
    }
}

// Command handler
function handleCommand(cmd, arg) {
    switch (cmd) {
        case 'play-pause': rb('--play-pause'); break;
        case 'next':       rb('--next'); break;
        case 'prev':       rb('--previous'); break;
        case 'stop':       rb('--stop'); break;
        case 'vol-up':     rb('--volume-up'); break;
        case 'vol-down':   rb('--volume-down'); break;
        case 'shuffle':    
            // Toggle shuffle
            const state = cachedState;
            rb(state._shuffle ? '--no-shuffle' : '--shuffle');
            cachedState._shuffle = !state._shuffle;
            break;
        case 'repeat':
            rb(cachedState._repeat ? '--no-repeat' : '--repeat');
            cachedState._repeat = !cachedState._repeat;
            break;
        case 'playlist':
            if (arg) {
                const pl = cachedPlaylists.find(p => p.name === arg);
                if (pl) {
                    activatePlaylist(pl.path);
                    activePlaylist = arg;
                    // Start playing from it
                    setTimeout(() => rb('--play'), 500);
                }
            }
            break;
        case 'rate-1': case 'rate-2': case 'rate-3': case 'rate-4': case 'rate-5':
            const stars = cmd.split('-')[1];
            rb(`--set-rating ${stars}`);
            break;
    }
    // Force immediate state refresh
    setTimeout(pollState, 200);
}

function pollState() {
    try {
        cachedState = getState();
        const ascii = renderASCII(cachedState, cachedPlaylists, activePlaylist);
        broadcast({
            type: 'state',
            state: cachedState,
            ascii,
            playlists: cachedPlaylists.map(p => p.name).filter(n => n !== 'Play Queue'),
            activePlaylist
        });
    } catch (e) {
        console.error('Poll error:', e.message);
    }
}

// HTTP server
const httpServer = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
        const html = readFileSync(join(__dirname, 'index.html'), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    } else if (url.pathname === '/api/state') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ state: cachedState, playlists: cachedPlaylists.map(p => p.name), activePlaylist }));
    } else if (url.pathname === '/api/command' && req.method === 'POST') {
        let body = '';
        req.on('data', d => body += d);
        req.on('end', () => {
            try {
                const { cmd, arg } = JSON.parse(body);
                handleCommand(cmd, arg);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// WebSocket
const wss = new WebSocketServer({ server: httpServer });
wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`Client connected (${clients.size} total)`);
    
    // Send initial state
    const ascii = renderASCII(cachedState, cachedPlaylists, activePlaylist);
    ws.send(JSON.stringify({
        type: 'state',
        state: cachedState,
        ascii,
        playlists: cachedPlaylists.map(p => p.name).filter(n => n !== 'Play Queue'),
        activePlaylist
    }));

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            if (msg.type === 'command') {
                handleCommand(msg.cmd, msg.arg);
            }
        } catch (e) {
            console.error('WS message error:', e.message);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`Client disconnected (${clients.size} total)`);
    });
});

// ─── Start ───────────────────────────────────────────────────────────

// Initial playlist fetch
cachedPlaylists = getPlaylists();
console.log(`Found ${cachedPlaylists.length} playlists`);

// Poll state
cachedState = getState();
setInterval(pollState, POLL_INTERVAL);

// Refresh playlists every 30s
setInterval(() => {
    cachedPlaylists = getPlaylists();
}, 30000);

httpServer.listen(PORT, () => {
    console.log(`\n  ♪ Rhythmbox Remote`);
    console.log(`  ─────────────────────────`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  WebSocket: ws://localhost:${PORT}`);
    console.log(`  ${cachedPlaylists.length} playlists loaded`);
    console.log(`  Now playing: ${cachedState.title || 'nothing'}\n`);
});
