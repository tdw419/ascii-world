/**
 * Unit tests for ProjectRegistry
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ProjectRegistry, ASCIIProject } from '../../src/manager/project-registry';

describe('ProjectRegistry', () => {
    let tempDir: string;
    let registryPath: string;
    let registry: ProjectRegistry;

    beforeEach(() => {
        // Create a temporary directory for each test
        tempDir = join('/tmp', `project-registry-test-${Date.now()}`);
        mkdirSync(tempDir, { recursive: true });
        registryPath = join(tempDir, '.ascii-registry.json');
        registry = new ProjectRegistry(registryPath);
    });

    afterEach(() => {
        // Clean up temp directory
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('constructor and load', () => {
        it('should create an empty registry when no file exists', () => {
            const freshRegistry = new ProjectRegistry(join(tempDir, 'new-registry.json'));
            expect(freshRegistry.getAllProjects()).toHaveLength(0);
        });

        it('should load existing projects from registry file', () => {
            // Create a registry file with existing data
            const existingData = {
                projects: [
                    {
                        id: 'test-project',
                        name: 'test-project',
                        path: '/path/to/test',
                        port: 3000,
                        status: 'stopped',
                        asciiPath: '/path/to/test/src/ascii/states',
                        bindingsPath: '/path/to/test/src/ascii/bindings.json'
                    }
                ]
            };
            writeFileSync(registryPath, JSON.stringify(existingData));

            // Create new registry that should load existing data
            const loadedRegistry = new ProjectRegistry(registryPath);
            const projects = loadedRegistry.getAllProjects();

            expect(projects).toHaveLength(1);
            expect(projects[0].id).toBe('test-project');
            expect(projects[0].port).toBe(3000);
        });

        it('should handle malformed JSON gracefully', () => {
            writeFileSync(registryPath, '{ invalid json }');
            // Suppress console.error for this test
            const originalError = console.error;
            console.error = () => {};

            try {
                const loadedRegistry = new ProjectRegistry(registryPath);
                expect(loadedRegistry.getAllProjects()).toHaveLength(0);
            } finally {
                console.error = originalError;
            }
        });
    });

    describe('registerProject', () => {
        it('should register a new project', () => {
            const projectPath = join(tempDir, 'my-project');
            mkdirSync(projectPath, { recursive: true });

            const project = registry.registerProject(projectPath, 3421);

            expect(project.id).toBe('my-project');
            expect(project.name).toBe('my-project');
            expect(project.path).toBe(projectPath);
            expect(project.port).toBe(3421);
            expect(project.status).toBe('stopped');
            expect(project.asciiPath).toBe(join(projectPath, 'src/ascii/states'));
            expect(project.bindingsPath).toBe(join(projectPath, 'src/ascii/bindings.json'));
        });

        it('should throw error for non-existent path', () => {
            expect(() => {
                registry.registerProject('/non/existent/path', 3421);
            }).toThrow('Project path does not exist');
        });

        it('should persist registered project to file', () => {
            const projectPath = join(tempDir, 'persisted-project');
            mkdirSync(projectPath, { recursive: true });

            registry.registerProject(projectPath, 3421);

            // Create a new registry instance to verify persistence
            const newRegistry = new ProjectRegistry(registryPath);
            const projects = newRegistry.getAllProjects();

            expect(projects).toHaveLength(1);
            expect(projects[0].id).toBe('persisted-project');
        });

        it('should return a copy of the project (immutability)', () => {
            const projectPath = join(tempDir, 'immutable-test');
            mkdirSync(projectPath, { recursive: true });

            const project1 = registry.registerProject(projectPath, 3421);
            const project2 = registry.getProject('immutable-test');

            expect(project1).not.toBe(project2); // Different object references
            expect(project1).toEqual(project2); // Same values
        });
    });

    describe('unregisterProject', () => {
        it('should unregister an existing project', () => {
            const projectPath = join(tempDir, 'to-remove');
            mkdirSync(projectPath, { recursive: true });
            registry.registerProject(projectPath, 3421);

            const result = registry.unregisterProject('to-remove');

            expect(result).toBe(true);
            expect(registry.getAllProjects()).toHaveLength(0);
        });

        it('should return false for non-existent project', () => {
            const result = registry.unregisterProject('non-existent');
            expect(result).toBe(false);
        });

        it('should persist removal to file', () => {
            const projectPath = join(tempDir, 'persisted-remove');
            mkdirSync(projectPath, { recursive: true });
            registry.registerProject(projectPath, 3421);

            registry.unregisterProject('persisted-remove');

            const newRegistry = new ProjectRegistry(registryPath);
            expect(newRegistry.getAllProjects()).toHaveLength(0);
        });
    });

    describe('getProject', () => {
        it('should return project by id', () => {
            const projectPath = join(tempDir, 'get-test');
            mkdirSync(projectPath, { recursive: true });
            registry.registerProject(projectPath, 3421);

            const project = registry.getProject('get-test');

            expect(project).toBeDefined();
            expect(project?.id).toBe('get-test');
        });

        it('should return undefined for non-existent project', () => {
            const project = registry.getProject('non-existent');
            expect(project).toBeUndefined();
        });

        it('should return a copy (immutability)', () => {
            const projectPath = join(tempDir, 'immutable-get');
            mkdirSync(projectPath, { recursive: true });
            registry.registerProject(projectPath, 3421);

            const project1 = registry.getProject('immutable-get');
            const project2 = registry.getProject('immutable-get');

            expect(project1).not.toBe(project2);
        });
    });

    describe('getAllProjects', () => {
        it('should return empty array when no projects', () => {
            expect(registry.getAllProjects()).toHaveLength(0);
        });

        it('should return all registered projects', () => {
            const path1 = join(tempDir, 'project1');
            const path2 = join(tempDir, 'project2');
            mkdirSync(path1, { recursive: true });
            mkdirSync(path2, { recursive: true });

            registry.registerProject(path1, 3421);
            registry.registerProject(path2, 3422);

            const projects = registry.getAllProjects();

            expect(projects).toHaveLength(2);
            expect(projects.map(p => p.id)).toContain('project1');
            expect(projects.map(p => p.id)).toContain('project2');
        });

        it('should return copies of projects (immutability)', () => {
            const projectPath = join(tempDir, 'immutable-all');
            mkdirSync(projectPath, { recursive: true });
            registry.registerProject(projectPath, 3421);

            const projects1 = registry.getAllProjects();
            const projects2 = registry.getAllProjects();

            expect(projects1[0]).not.toBe(projects2[0]);
        });
    });

    describe('updateProjectStatus', () => {
        it('should update project status to running', () => {
            const projectPath = join(tempDir, 'status-test');
            mkdirSync(projectPath, { recursive: true });
            registry.registerProject(projectPath, 3421);

            registry.updateProjectStatus('status-test', 'running', 12345);

            const project = registry.getProject('status-test');
            expect(project?.status).toBe('running');
            expect(project?.pid).toBe(12345);
            expect(project?.lastStarted).toBeDefined();
        });

        it('should update project status to error', () => {
            const projectPath = join(tempDir, 'error-test');
            mkdirSync(projectPath, { recursive: true });
            registry.registerProject(projectPath, 3421);

            registry.updateProjectStatus('error-test', 'error');

            const project = registry.getProject('error-test');
            expect(project?.status).toBe('error');
            expect(project?.pid).toBeUndefined();
        });

        it('should not update non-existent project', () => {
            // Should not throw
            expect(() => {
                registry.updateProjectStatus('non-existent', 'running');
            }).not.toThrow();
        });

        it('should persist status updates to file', () => {
            const projectPath = join(tempDir, 'persist-status');
            mkdirSync(projectPath, { recursive: true });
            registry.registerProject(projectPath, 3421);
            registry.updateProjectStatus('persist-status', 'running', 99999);

            const newRegistry = new ProjectRegistry(registryPath);
            const project = newRegistry.getProject('persist-status');

            expect(project?.status).toBe('running');
            expect(project?.pid).toBe(99999);
        });
    });

    describe('discoverProjects', () => {
        it('should discover projects with ASCII interface markers', () => {
            // Create a project with bindings.json
            const projectPath = join(tempDir, 'discovered-project');
            const asciiDir = join(projectPath, 'src/ascii');
            mkdirSync(asciiDir, { recursive: true });
            writeFileSync(join(asciiDir, 'bindings.json'), '{}');

            const discovered = registry.discoverProjects(tempDir);

            expect(discovered).toContain(projectPath);
        });

        it('should not discover projects without bindings.json', () => {
            const projectPath = join(tempDir, 'non-ascii-project');
            mkdirSync(projectPath, { recursive: true });
            // No bindings.json created

            const discovered = registry.discoverProjects(tempDir);

            expect(discovered).not.toContain(projectPath);
        });

        it('should respect recursion depth limit', () => {
            // Create deeply nested structure
            const deepPath = join(tempDir, 'a', 'b', 'c', 'd', 'deep-project');
            const asciiDir = join(deepPath, 'src/ascii');
            mkdirSync(asciiDir, { recursive: true });
            writeFileSync(join(asciiDir, 'bindings.json'), '{}');

            const discovered = registry.discoverProjects(tempDir);

            // Should not find it because depth > 3
            expect(discovered).not.toContain(deepPath);
        });

        it('should skip node_modules and .git directories', () => {
            // Create valid projects in node_modules and .git that would be discovered
            // if the filtering didn't work
            const nodeModulesProject = join(tempDir, 'node_modules', 'pkg');
            const nodeModulesAscii = join(nodeModulesProject, 'src', 'ascii');
            mkdirSync(nodeModulesAscii, { recursive: true });
            writeFileSync(join(nodeModulesAscii, 'bindings.json'), '{}');

            const gitProject = join(tempDir, '.git');
            const gitAscii = join(gitProject, 'src', 'ascii');
            mkdirSync(gitAscii, { recursive: true });
            writeFileSync(join(gitAscii, 'bindings.json'), '{}');

            const discovered = registry.discoverProjects(tempDir);

            // The implementation skips node_modules and .git directories during scanning
            // so these projects should NOT be discovered
            expect(discovered).not.toContainEqual(expect.stringContaining('/node_modules/'));
            expect(discovered).not.toContainEqual(expect.stringContaining('/.git/'));
        });
    });

    describe('findAvailablePort', () => {
        it('should return start port when no projects', () => {
            const port = registry.findAvailablePort(3421);
            expect(port).toBe(3421);
        });

        it('should find next available port', () => {
            const path1 = join(tempDir, 'port1');
            const path2 = join(tempDir, 'port2');
            mkdirSync(path1, { recursive: true });
            mkdirSync(path2, { recursive: true });

            registry.registerProject(path1, 3421);
            registry.registerProject(path2, 3422);

            const port = registry.findAvailablePort(3421);
            expect(port).toBe(3423);
        });

        it('should skip used ports', () => {
            const path1 = join(tempDir, 'skip-port');
            mkdirSync(path1, { recursive: true });
            registry.registerProject(path1, 3421);

            const port = registry.findAvailablePort(3420);
            expect(port).toBe(3420);
        });

        it('should use default start port of 3421', () => {
            const port = registry.findAvailablePort();
            expect(port).toBe(3421);
        });
    });
});
