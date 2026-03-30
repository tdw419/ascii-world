import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AutoRenderer } from '../AutoRenderer';
import { useAsciiState } from '../../hooks/useAsciiState';
import { SaccadeRenderer } from '../../webgpu/SaccadeRenderer';
import './MasterPortal.css';

// Dynamic substrate URLs
const MANAGER_URL = 'http://localhost:3422';
const WP_URL = 'http://localhost:3450';
const CLAW_URL = 'http://localhost:3425';
const YOUTUBE_URL = 'http://localhost:3470';
const PHP_URL = 'http://localhost:3480';

// Global keys that always go to the Manager
const GLOBALS = ['A', 'B', 'R', 'H', 'M', 'X'];

export function MasterPortal() {
    const { view: managerView, sendControl: sendManagerControl } = useAsciiState(MANAGER_URL);
    const [wpView, setWpView] = useState<string>('');
    const [clawView, setClawView] = useState<string>('');
    const [youtubeView, setYoutubeView] = useState<string>('');
    const [focus, setFocus] = useState<'WP' | 'CLAW' | 'YOUTUBE' | 'PHP'>('WP');
    const [showHelp, setShowHelp] = useState(false);
    const [phpView, setPhpView] = useState<string>('');
    
    // Neural Map GPU State
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rendererRef = useRef<SaccadeRenderer | null>(null);

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

            // Poll PHP Bridge
            try {
                const res = await fetch(PHP_URL + '/');
                if (res.ok) setPhpView(await res.text());
            } catch (e) { setPhpView("PHP BRIDGE OFFLINE [3480]"); }
        };

        const interval = setInterval(pollSubstrates, 1500);
        return () => clearInterval(interval);
    }, []);

    // Neural Path Polling (OpenMind Integration)
    useEffect(() => {
        const fetchNeuralPaths = async () => {
            try {
                // Fetch the generated neural paths from the ouroboros visualization dir
                // Note: In production, this would be served by a backend or streamed via WebSocket
                const res = await fetch('/.ouroboros/visualizations/neural_paths.json');
                if (res.ok) {
                    const data = await res.json();
                    if (rendererRef.current && data.paths) {
                        rendererRef.current.setPaths(data.paths);
                    }
                }
            } catch (e) {
                // Silently fail if paths aren't ready yet
            }
        };

        const interval = setInterval(fetchNeuralPaths, 2000);
        return () => clearInterval(interval);
    }, []);

    // Initialize WebGPU Renderer
    useEffect(() => {
        if (canvasRef.current && !rendererRef.current) {
            const renderer = new SaccadeRenderer(canvasRef.current);
            renderer.init().then(() => {
                rendererRef.current = renderer;
                
                // Start render loop
                const frame = (time: number) => {
                    renderer.render(time);
                    requestAnimationFrame(frame);
                };
                requestAnimationFrame(frame);
            });
        }
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
        } else if (sourceSubstrate === 'PHP' || (focus === 'PHP' && !sourceSubstrate)) {
            targetUrl = PHP_URL;
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
                        onClick={() => setFocus('PHP')}
                        style={{ background: focus === 'PHP' ? '#ff9900' : '#222', color: focus === 'PHP' ? '#000' : '#888', border: 'none', padding: '5px 10px', cursor: 'pointer' }}
                    >FOCUS: PHP</button>
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
                        <span>Neural Map [GPU Accelerated]</span>
                        <span style={{ color: '#00ff88' }}>● Live (Attention Stream)</span>
                    </h3>
                    
                    {/* WebGPU Saccade Visualization */}
                    <div className="neural-gpu-container" style={{ 
                        width: '100%', 
                        height: '300px', 
                        background: '#050508', 
                        border: '1px solid #1a1a2e',
                        marginBottom: '20px',
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <canvas 
                            ref={canvasRef} 
                            width={800} 
                            height={300} 
                            style={{ width: '100%', height: '100%', display: 'block' }}
                        />
                        <div style={{
                            position: 'absolute',
                            bottom: '10px',
                            right: '10px',
                            fontSize: '10px',
                            color: '#444',
                            pointerEvents: 'none'
                        }}>WEBGPU :: OPENMIND_SHIMMER.WGSL</div>
                    </div>

                    <div className="raw-ascii-buffer">
                        <div style={{ marginBottom: '15px', opacity: 0.5 }}>// Manager (3422)</div>
                        <pre style={{ marginBottom: '20px' }}>{managerView}</pre>

                        <div style={{ marginBottom: '15px', opacity: 0.5, color: 'var(--neon-green)' }}>// WordPress (3450)</div>
                        <pre style={{ marginBottom: '20px' }}>{wpView}</pre>
                        
                        {/* ... (rest of the pre blocks) */}
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

                    <div className={`glass-card ${focus === 'PHP' ? 'focused' : ''}`} style={{ borderLeft: '4px solid #ff9900' }}>
                        <div className="card-title" style={{ color: '#ff9900' }}>PHP Site Bridge</div>
                        <AutoRenderer ascii={phpView} onControl={(l) => handleControl(l, 'PHP')} />
                    </div>
                </section>
            </main>

            <footer className="portal-footer">
                <div>Phase Alignment: Penta-Sync Active</div>
                <div>Substrates: 5 Running</div>
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
