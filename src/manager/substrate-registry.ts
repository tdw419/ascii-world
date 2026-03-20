/**
 * Substrate Registry
 * Auto-discovers running ASCII World substrates on known ports.
 */

export interface Substrate {
    id: string;
    name: string;
    port: number;
    color: string;
    status: 'online' | 'offline' | 'error';
    lastSeen: number | null;
}

const KNOWN_SUBSTRATES: Omit<Substrate, 'status' | 'lastSeen'>[] = [
    { id: 'manager', name: 'System Orchestrator', port: 3422, color: '#00d9ff' },
    { id: 'wordpress', name: 'WordPress Bridge', port: 3450, color: '#00ff88' },
    { id: 'clawlauncher', name: 'ClawLauncher', port: 3425, color: '#00d9ff' },
    { id: 'youtube', name: 'Safe YouTube', port: 3470, color: '#ff0055' },
];

export class SubstrateRegistry {
    private substrates: Map<string, Substrate> = new Map();
    private listeners: Set<() => void> = new Set();

    constructor() {
        // Initialize all as offline
        for (const s of KNOWN_SUBSTRATES) {
            this.substrates.set(s.id, { ...s, status: 'offline', lastSeen: null });
        }
    }

    async scan(): Promise<Substrate[]> {
        const results = await Promise.all(
            KNOWN_SUBSTRATES.map(async (s) => {
                try {
                    const res = await fetch(`http://localhost:${s.port}/health`, {
                        signal: AbortSignal.timeout(2000)
                    });
                    if (res.ok) {
                        return { ...s, status: 'online' as const, lastSeen: Date.now() };
                    }
                } catch {}
                return { ...s, status: 'offline' as const, lastSeen: null };
            })
        );

        for (const s of results) {
            this.substrates.set(s.id, s);
        }

        this.notify();
        return results;
    }

    getSubstrates(): Substrate[] {
        return Array.from(this.substrates.values());
    }

    getOnline(): Substrate[] {
        return this.getSubstrates().filter(s => s.status === 'online');
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        for (const l of this.listeners) l();
    }
}

// Singleton
export const registry = new SubstrateRegistry();
