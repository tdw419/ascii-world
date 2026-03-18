/**
 * Project Registry for ASCII Interface Manager
 *
 * Manages the list of ASCII-wrapped projects and their state.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface ASCIIProject {
    id: string;
    name: string;
    path: string;
    port: number;
    status: 'running' | 'stopped' | 'error';
    pid?: number;
    lastStarted?: number;
    asciiPath: string;
    bindingsPath: string;
}

export class ProjectRegistry {
    private projects: Map<string, ASCIIProject> = new Map();
    private registryPath: string;

    constructor(registryPath: string = '.ascii-registry.json') {
        this.registryPath = registryPath;
        this.load();
    }

    private load(): void {
        if (existsSync(this.registryPath)) {
            try {
                const rawData = readFileSync(this.registryPath, 'utf8');
                const data = JSON.parse(rawData);
                for (const project of data.projects || []) {
                    this.projects.set(project.id, project);
                }
            } catch (error) {
                // Handle malformed JSON or read errors - start with empty registry
                console.error(`Failed to load registry from ${this.registryPath}:`, error);
                this.projects = new Map();
            }
        }
    }

    private save(): void {
        const data = {
            projects: Array.from(this.projects.values())
        };
        try {
            writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Failed to save registry to ${this.registryPath}:`, error);
            throw new Error(`Failed to save project registry: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    public registerProject(path: string, port: number): ASCIIProject {
        // Validate path exists
        if (!existsSync(path)) {
            throw new Error(`Project path does not exist: ${path}`);
        }

        const id = basename(path);
        const project: ASCIIProject = {
            id,
            name: id,
            path,
            port,
            status: 'stopped',
            asciiPath: join(path, 'src/ascii/states'),
            bindingsPath: join(path, 'src/ascii/bindings.json')
        };
        this.projects.set(id, project);
        this.save();
        return { ...project }; // Return a copy
    }

    public unregisterProject(id: string): boolean {
        const result = this.projects.delete(id);
        if (result) {
            this.save();
        }
        return result;
    }

    public getProject(id: string): ASCIIProject | undefined {
        const project = this.projects.get(id);
        return project ? { ...project } : undefined;
    }

    public getAllProjects(): ASCIIProject[] {
        return Array.from(this.projects.values()).map(p => ({ ...p }));
    }

    public updateProjectStatus(id: string, status: ASCIIProject['status'], pid?: number): void {
        const project = this.projects.get(id);
        if (project) {
            // Create a new object instead of mutating
            const updatedProject: ASCIIProject = {
                ...project,
                status,
                ...(pid !== undefined && { pid }),
                ...(status === 'running' && { lastStarted: Date.now() })
            };
            this.projects.set(id, updatedProject);
            this.save();
        }
    }

    public discoverProjects(searchPath: string): string[] {
        const discovered: string[] = [];

        const scanDir = (dir: string, depth: number = 0) => {
            if (depth > 3) return; // Limit recursion depth

            try {
                const entries = readdirSync(dir);
                for (const entry of entries) {
                    const fullPath = join(dir, entry);
                    try {
                        const stat = statSync(fullPath);
                        if (stat.isDirectory()) {
                            // Check if this directory has ASCII interface markers
                            const bindingsPath = join(fullPath, 'src/ascii/bindings.json');
                            if (existsSync(bindingsPath)) {
                                discovered.push(fullPath);
                            } else if (entry !== 'node_modules' && entry !== '.git') {
                                scanDir(fullPath, depth + 1);
                            }
                        }
                    } catch {
                        // Skip inaccessible directories
                    }
                }
            } catch {
                // Skip directories we can't read
            }
        };

        scanDir(searchPath);
        return discovered;
    }

    public findAvailablePort(startPort: number = 3421): number {
        const usedPorts = new Set(
            Array.from(this.projects.values()).map(p => p.port)
        );
        let port = startPort;
        while (usedPorts.has(port)) {
            port++;
        }
        return port;
    }
}
