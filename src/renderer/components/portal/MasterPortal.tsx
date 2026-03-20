import React, { useEffect, useState, useCallback } from 'react';
import { AutoRenderer } from '../AutoRenderer';
import { useAsciiState } from '../../hooks/useAsciiState';
import './MasterPortal.css';

const MANAGER_URL = 'http://localhost:3422';
const HERO_URL = 'http://localhost:3450';
const GLOBALS = ['A', 'B', 'R', 'H', 'M', 'X'];

export function MasterPortal() {
    const { view: managerView, sendControl: sendManagerControl } = useAsciiState(MANAGER_URL);
    const [heroView, setHeroView] = useState<string>('');
    const [lastUpdate, setLastUpdate] = useState(Date.now());

    // Dual-Polling Stream
    useEffect(() => {
        const poll = async () => {
            try {
                const res = await fetch(HERO_URL + '/');
                if (res.ok) setHeroView(await res.text());
            } catch (e) {
                setHeroView("SUBSYSTEM OFFLINE [3450]");
            }
        };
        const interval = setInterval(poll, 1500);
        return () => clearInterval(interval);
    }, []);

    const handleControl = useCallback(async (label: string) => {
        if (GLOBALS.includes(label)) {
            sendManagerControl({ label });
        } else {
            try {
                await fetch(HERO_URL + '/control', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ label })
                });
                setLastUpdate(Date.now());
            } catch (e) {
                console.error("Hero control failed", e);
            }
        }
    }, [sendManagerControl]);

    return (
        <div className="portal-root">
            <header className="portal-header">
                <h1>ASCII WORLD :: MASTER PORTAL</h1>
            </header>

            <main className="portal-grid">
                {/* SOURCE PANE: What the AI sees */}
                <aside className="source-pane">
                    <h3>
                        <span>Neural Map [Raw Tokens]</span>
                        <span style={{ color: '#00ff88' }}>● Live</span>
                    </h3>
                    <div className="raw-ascii-buffer">
                        <div style={{ marginBottom: '20px', borderLeft: '2px solid #333', paddingLeft: '10px' }}>
                            <div style={{ color: '#444', marginBottom: '5px' }}>// Manager Buffer (3422)</div>
                            {managerView}
                        </div>
                        <div style={{ borderLeft: '2px solid #333', paddingLeft: '10px' }}>
                            <div style={{ color: '#444', marginBottom: '5px' }}>// WordPress Buffer (3450)</div>
                            {heroView}
                        </div>
                    </div>
                </aside>

                {/* REALITY PANE: What the Human sees */}
                <section className="reality-pane">
                    <div className="glass-card">
                        <div className="card-title">System Orchestrator</div>
                        <AutoRenderer 
                            ascii={managerView} 
                            onControl={handleControl} 
                        />
                    </div>

                    <div className="glass-card" style={{ borderLeft: '4px solid var(--neon-green)' }}>
                        <div className="card-title" style={{ color: 'var(--neon-green)' }}>WordPress Hero Substrate</div>
                        <AutoRenderer 
                            ascii={heroView} 
                            onControl={handleControl} 
                        />
                    </div>
                </section>
            </main>

            <footer className="portal-footer">
                <div>Phase Alignment: Stable</div>
                <div>Tokens: 2.4k / Frame</div>
                <div>Architecture: Hybrid Spatial OS</div>
            </footer>
        </div>
    );
}
