import React, { useEffect, useState, useCallback } from 'react';
import { AutoRenderer } from '../AutoRenderer';
import { useAsciiState } from '../../hooks/useAsciiState';
import './MasterPortal.css';

// Dynamic substrate URLs
const MANAGER_URL = 'http://localhost:3422';
const WP_URL = 'http://localhost:3450';
const CLAW_URL = 'http://localhost:3425';
const YOUTUBE_URL = 'http://localhost:3470';

// Global keys that always go to the Manager
const GLOBALS = ['A', 'B', 'R', 'H', 'M', 'X'];

export function MasterPortal() {
    const { view: managerView, sendControl: sendManagerControl } = useAsciiState(MANAGER_URL);
    const [wpView, setWpView] = useState<string>('');
    const [clawView, setClawView] = useState<string>('');
    const [youtubeView, setYoutubeView] = useState<string>('');
    const [focus, setFocus] = useState<'WP' | 'CLAW' | 'YOUTUBE'>('WP');
    const [showHelp, setShowHelp] = useState(false);

    // Quad-Polling Stream
    useEffect(() => {
        const pollSubstrates = async () => {
            // Poll WordPress
            try {
                const res = await fetch(WP_URL + '/');
                if (res.ok) setWpView(await res.text());
            } catch (e) { setWpView("WORDPRESS OFFLINE [3450]"); }

            // Poll ClawLauncher
            try {
                const res = await fetch(CLAW_URL + '/view', { headers: { 'Accept': 'text/plain' } });
                if (res.ok) setClawView(await res.text());
            } catch (e) { setClawView("CLAWLAUNCHER OFFLINE [3425]"); }

            // Poll Safe YouTube
            try {
                const res = await fetch(YOUTUBE_URL + '/');
                if (res.ok) setYoutubeView(await res.text());
            } catch (e) { setYoutubeView("SAFE YOUTUBE OFFLINE [3470]"); }
        };

        const interval = setInterval(pollSubstrates, 1500);
        return () => clearInterval(interval);
    }, []);

    // Keyboard help toggle
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                setShowHelp(h => !h);
            } else if (e.key === 'Escape' && showHelp) {
                setShowHelp(false);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [showHelp]);

    const handleControl = useCallback(async (label: string, sourceSubstrate?: string) => {
        console.log(`[Portal] Label: ${label} | Source: ${sourceSubstrate}`);

        // 1. Global Route
        if (GLOBALS.includes(label)) {
            sendManagerControl({ label });
            return;
        }

        // 2. Focused Routing
        let targetUrl = WP_URL;
        if (sourceSubstrate === 'CLAW' || (focus === 'CLAW' && !sourceSubstrate)) {
            targetUrl = CLAW_URL;
        } else if (sourceSubstrate === 'YOUTUBE' || (focus === 'YOUTUBE' && !sourceSubstrate)) {
            targetUrl = YOUTUBE_URL;
        }

        try {
            await fetch(targetUrl + '/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label })
            });
        } catch (e) {
            console.error(`Control failed for ${targetUrl}`, e);
        }
    }, [sendManagerControl, focus]);

    return (
        <div className="portal-root">
            <header className="portal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>ASCII WORLD :: MASTER PORTAL</h1>
                <div className="focus-toggle" style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => setFocus('WP')}
                        style={{ background: focus === 'WP' ? 'var(--neon-green)' : '#222', color: '#000', border: 'none', padding: '5px 10px', cursor: 'pointer' }}
                    >FOCUS: WP</button>
                    <button
                        onClick={() => setFocus('CLAW')}
                        style={{ background: focus === 'CLAW' ? 'var(--neon-blue)' : '#222', color: '#000', border: 'none', padding: '5px 10px', cursor: 'pointer' }}
                    >FOCUS: CLAW</button>
                    <button
                        onClick={() => setFocus('YOUTUBE')}
                        style={{ background: focus === 'YOUTUBE' ? '#ff0055' : '#222', color: '#fff', border: 'none', padding: '5px 10px', cursor: 'pointer' }}
                    >FOCUS: YT</button>
                    <button
                        onClick={() => setShowHelp(!showHelp)}
                        style={{ background: showHelp ? '#fff' : '#333', color: showHelp ? '#000' : '#888', border: 'none', padding: '5px 10px', cursor: 'pointer' }}
                    >?</button>
                </div>
            </header>

            <main className="portal-grid">
                {/* SOURCE PANE: Neural Map */}
                <aside className="source-pane">
                    <h3>
                        <span>Neural Map [Raw Substrates]</span>
                        <span style={{ color: '#00ff88' }}>● Live (4 Stream)</span>
                    </h3>
                    <div className="raw-ascii-buffer">
                        <div style={{ marginBottom: '15px', opacity: 0.5 }}>// Manager (3422)</div>
                        <pre style={{ marginBottom: '20px' }}>{managerView}</pre>

                        <div style={{ marginBottom: '15px', opacity: 0.5, color: 'var(--neon-green)' }}>// WordPress (3450)</div>
                        <pre style={{ marginBottom: '20px' }}>{wpView}</pre>

                        <div style={{ marginBottom: '15px', opacity: 0.5, color: 'var(--neon-blue)' }}>// ClawLauncher (3425)</div>
                        <pre style={{ marginBottom: '20px' }}>{clawView}</pre>

                        <div style={{ marginBottom: '15px', opacity: 0.5, color: '#ff0055' }}>// Safe YouTube (3470)</div>
                        <pre>{youtubeView}</pre>
                    </div>
                </aside>

                {/* REALITY PANE: The Stack */}
                <section className="reality-pane">
                    <div className="glass-card" style={{ borderTop: '2px solid var(--neon-blue)' }}>
                        <div className="card-title">System Orchestrator</div>
                        <AutoRenderer ascii={managerView} onControl={(l) => handleControl(l, 'MANAGER')} />
                    </div>

                    <div className={`glass-card ${focus === 'WP' ? 'focused' : ''}`} style={{ borderLeft: '4px solid var(--neon-green)' }}>
                        <div className="card-title" style={{ color: 'var(--neon-green)' }}>WordPress Substrate</div>
                        <AutoRenderer ascii={wpView} onControl={(l) => handleControl(l, 'WP')} />
                    </div>

                    <div className={`glass-card ${focus === 'CLAW' ? 'focused' : ''}`} style={{ borderLeft: '4px solid var(--neon-blue)' }}>
                        <div className="card-title" style={{ color: 'var(--neon-blue)' }}>ClawLauncher (Agent Control)</div>
                        <AutoRenderer ascii={clawView} onControl={(l) => handleControl(l, 'CLAW')} />
                    </div>

                    <div className={`glass-card ${focus === 'YOUTUBE' ? 'focused' : ''}`} style={{ borderLeft: '4px solid #ff0055' }}>
                        <div className="card-title" style={{ color: '#ff0055' }}>Safe YouTube (Audio Only)</div>
                        <AutoRenderer ascii={youtubeView} onControl={(l) => handleControl(l, 'YOUTUBE')} />
                    </div>
                </section>
            </main>

            <footer className="portal-footer">
                <div>Phase Alignment: Quad-Sync Active</div>
                <div>Substrates: 4 Running</div>
                <div>Standard: Neural-Reality v2</div>
            </footer>

            {/* Help Overlay */}
            {showHelp && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    cursor: 'pointer'
                }} onClick={() => setShowHelp(false)}>
                    <div style={{
                        background: '#111',
                        border: '1px solid #333',
                        borderRadius: '12px',
                        padding: '30px',
                        maxWidth: '500px',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#e0e0e0'
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ color: 'var(--neon-green)', marginBottom: '20px' }}>⌨ Keyboard Shortcuts</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <div>
                                <h3 style={{ color: 'var(--neon-blue)', marginBottom: '10px' }}>Global</h3>
                                <div><code style={{ color: '#00ff88' }}>[A]</code> Projects</div>
                                <div><code style={{ color: '#00ff88' }}>[B]</code> Templates</div>
                                <div><code style={{ color: '#00ff88' }}>[R]</code> Refresh All</div>
                                <div><code style={{ color: '#00ff88' }}>[H]</code> Health Check</div>
                                <div><code style={{ color: '#00ff88' }}>[X]</code> Global Shutdown</div>
                            </div>
                            <div>
                                <h3 style={{ color: '#ff0055', marginBottom: '10px' }}>YouTube</h3>
                                <div><code style={{ color: '#00ff88' }}>[1-3]</code> Select Video</div>
                                <div><code style={{ color: '#00ff88' }}>[P]</code> Play</div>
                                <div><code style={{ color: '#00ff88' }}>[S]</code> Stop</div>
                                <div><code style={{ color: '#00ff88' }}>[M]</code> Mute</div>
                            </div>
                        </div>
                        <div style={{ marginTop: '20px', color: '#666', fontSize: '12px' }}>
                            Click anywhere to close
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
