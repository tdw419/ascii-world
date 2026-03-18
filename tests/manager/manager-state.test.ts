/**
 * Unit tests for ManagerStateManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
    ManagerStateManager,
    ManagerState,
    ManagerContext,
    TestResults,
    GitStatus
} from '../../src/manager/manager-state';

describe('ManagerStateManager', () => {
    let tempDir: string;
    let manager: ManagerStateManager;

    beforeEach(() => {
        tempDir = join('/tmp', `manager-state-test-${Date.now()}`);
        mkdirSync(tempDir, { recursive: true });
        // Use default bindings (no custom path needed for most tests)
        manager = new ManagerStateManager();
    });

    afterEach(() => {
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('initial state', () => {
        it('should initialize with PROJECTS state', () => {
            expect(manager.getState()).toBe('PROJECTS');
        });

        it('should initialize with no selected project', () => {
            const data = manager.getData();
            expect(data.selectedProjectId).toBeNull();
        });

        it('should initialize with no selected template', () => {
            const data = manager.getData();
            expect(data.selectedTemplateFile).toBeNull();
            expect(data.templateScrollOffset).toBe(0);
        });

        it('should initialize with edit mode disabled', () => {
            const data = manager.getData();
            expect(data.editMode).toBe(false);
            expect(data.editBuffer).toEqual([]);
            expect(data.unsavedChanges).toBe(false);
        });

        it('should initialize with no test results or git status', () => {
            const data = manager.getData();
            expect(data.testResults).toBeNull();
            expect(data.gitStatus).toBeNull();
        });
    });

    describe('state transitions', () => {
        it('should transition from PROJECTS to TEMPLATES', () => {
            const result = manager.handleAction('B');
            expect(result.success).toBe(true);
            expect(result.action).toBe('goto_templates');
            expect(manager.getState()).toBe('TEMPLATES');
        });

        it('should transition from PROJECTS to BINDINGS', () => {
            const result = manager.handleAction('C');
            expect(result.success).toBe(true);
            expect(result.action).toBe('goto_bindings');
            expect(manager.getState()).toBe('BINDINGS');
        });

        it('should transition from PROJECTS to TEST', () => {
            const result = manager.handleAction('D');
            expect(result.success).toBe(true);
            expect(result.action).toBe('goto_test');
            expect(manager.getState()).toBe('TEST');
        });

        it('should transition from PROJECTS to GIT', () => {
            const result = manager.handleAction('E');
            expect(result.success).toBe(true);
            expect(result.action).toBe('goto_git');
            expect(manager.getState()).toBe('GIT');
        });

        it('should handle QUIT action', () => {
            const result = manager.handleAction('X');
            expect(result.success).toBe(true);
            expect(result.action).toBe('quit');
        });

        it('should return error for invalid action label', () => {
            const result = manager.handleAction('Z');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('setState', () => {
        it('should directly set state', () => {
            manager.setState('TEMPLATES');
            expect(manager.getState()).toBe('TEMPLATES');
        });

        it('should allow setting all valid states', () => {
            const states: ManagerState[] = ['PROJECTS', 'TEMPLATES', 'BINDINGS', 'TEST', 'GIT'];

            for (const state of states) {
                manager.setState(state);
                expect(manager.getState()).toBe(state);
            }
        });
    });

    describe('project selection', () => {
        it('should select a project', () => {
            manager.selectProject('my-project');
            const data = manager.getData();
            expect(data.selectedProjectId).toBe('my-project');
        });

        it('should clear selected project', () => {
            manager.selectProject('my-project');
            manager.clearSelectedProject();
            const data = manager.getData();
            expect(data.selectedProjectId).toBeNull();
        });
    });

    describe('template selection', () => {
        it('should select a template file', () => {
            manager.selectTemplate('main.ascii');
            const data = manager.getData();
            expect(data.selectedTemplateFile).toBe('main.ascii');
            expect(data.templateScrollOffset).toBe(0);
        });

        it('should clear selected template', () => {
            manager.selectTemplate('main.ascii');
            manager.clearSelectedTemplate();
            const data = manager.getData();
            expect(data.selectedTemplateFile).toBeNull();
            expect(data.templateScrollOffset).toBe(0);
        });

        it('should scroll template up', () => {
            manager.setTemplateScrollOffset(5);
            manager.scrollTemplate('up');
            const data = manager.getData();
            expect(data.templateScrollOffset).toBe(4);
        });

        it('should scroll template down', () => {
            manager.setTemplateScrollOffset(5);
            manager.scrollTemplate('down');
            const data = manager.getData();
            expect(data.templateScrollOffset).toBe(6);
        });

        it('should not scroll below 0', () => {
            manager.setTemplateScrollOffset(0);
            manager.scrollTemplate('up');
            const data = manager.getData();
            expect(data.templateScrollOffset).toBe(0);
        });

        it('should set template scroll offset', () => {
            manager.setTemplateScrollOffset(10);
            const data = manager.getData();
            expect(data.templateScrollOffset).toBe(10);
        });

        it('should not set negative scroll offset', () => {
            manager.setTemplateScrollOffset(-5);
            const data = manager.getData();
            expect(data.templateScrollOffset).toBe(0);
        });
    });

    describe('edit mode', () => {
        it('should enter edit mode', () => {
            manager.enterEditMode(['line 1', 'line 2', 'line 3']);
            const data = manager.getData();
            expect(data.editMode).toBe(true);
            expect(data.editBuffer).toEqual(['line 1', 'line 2', 'line 3']);
        });

        it('should exit edit mode without saving', () => {
            manager.enterEditMode(['line 1']);
            manager.exitEditMode(false);
            const data = manager.getData();
            expect(data.editMode).toBe(false);
            expect(data.unsavedChanges).toBe(false);
        });

        it('should exit edit mode with saving', () => {
            manager.enterEditMode(['line 1']);
            manager.exitEditMode(true);
            const data = manager.getData();
            expect(data.editMode).toBe(false);
            expect(data.unsavedChanges).toBe(true);
        });

        it('should preserve existing unsaved changes when exiting without save', () => {
            manager.enterEditMode(['line 1']);
            manager.exitEditMode(true); // First save sets unsavedChanges to true
            manager.enterEditMode(['line 2']);
            manager.exitEditMode(false); // Should preserve unsavedChanges
            const data = manager.getData();
            expect(data.unsavedChanges).toBe(true);
        });

        it('should update edit buffer', () => {
            manager.enterEditMode(['line 1']);
            manager.updateEditBuffer(['line 1', 'line 2', 'line 3']);
            const data = manager.getData();
            expect(data.editBuffer).toEqual(['line 1', 'line 2', 'line 3']);
        });

        it('should mark changes as saved', () => {
            manager.enterEditMode(['line 1']);
            manager.exitEditMode(true);
            manager.markChangesSaved();
            const data = manager.getData();
            expect(data.unsavedChanges).toBe(false);
        });
    });

    describe('test results', () => {
        const mockTestResults: TestResults = {
            passed: 10,
            failed: 2,
            skipped: 1,
            total: 13,
            duration: 1500,
            failedTests: [
                { name: 'test 1', error: 'Expected true, got false' },
                { name: 'test 2', error: 'Timeout exceeded' }
            ],
            lastRun: Date.now()
        };

        it('should set test results', () => {
            manager.setTestResults(mockTestResults);
            const data = manager.getData();
            expect(data.testResults).toEqual(mockTestResults);
        });

        it('should store test results', () => {
            manager.setTestResults(mockTestResults);
            const data = manager.getData();
            expect(data.testResults?.passed).toBe(10);
            expect(data.testResults?.failed).toBe(2);
        });

        it('should clear test results', () => {
            manager.setTestResults(mockTestResults);
            manager.clearTestResults();
            const data = manager.getData();
            expect(data.testResults).toBeNull();
        });
    });

    describe('git status', () => {
        const mockGitStatus: GitStatus = {
            branch: 'feature/test',
            ahead: 2,
            behind: 1,
            staged: ['file1.ts', 'file2.ts'],
            unstaged: ['file3.ts'],
            untracked: ['file4.ts'],
            lastCommit: {
                hash: 'abc123',
                message: 'Test commit',
                author: 'Test Author',
                date: '2026-03-18'
            }
        };

        it('should set git status', () => {
            manager.setGitStatus(mockGitStatus);
            const data = manager.getData();
            expect(data.gitStatus).toEqual(mockGitStatus);
        });

        it('should store git status', () => {
            manager.setGitStatus(mockGitStatus);
            const data = manager.getData();
            expect(data.gitStatus?.branch).toBe('feature/test');
            expect(data.gitStatus?.staged).toContain('file1.ts');
        });

        it('should clear git status', () => {
            manager.setGitStatus(mockGitStatus);
            manager.clearGitStatus();
            const data = manager.getData();
            expect(data.gitStatus).toBeNull();
        });
    });

    describe('getData (immutability)', () => {
        it('should return a copy of the context', () => {
            const data1 = manager.getData();
            const data2 = manager.getData();

            expect(data1).not.toBe(data2);
            expect(data1.editBuffer).not.toBe(data2.editBuffer);
        });

        it('should not allow external modification of internal state', () => {
            manager.enterEditMode(['line 1']);
            const data = manager.getData();
            data.editBuffer.push('modified');

            const internalData = manager.getData();
            expect(internalData.editBuffer).toEqual(['line 1']);
        });
    });

    describe('getBindings', () => {
        it('should return bindings configuration', () => {
            const bindings = manager.getBindings();

            expect(bindings.bindings).toBeDefined();
            expect(bindings.stateTransitions).toBeDefined();
        });

        it('should return a deep copy of bindings', () => {
            const bindings1 = manager.getBindings();
            const bindings2 = manager.getBindings();

            expect(bindings1).not.toBe(bindings2);
            expect(bindings1.bindings).not.toBe(bindings2.bindings);
            expect(bindings1.stateTransitions).not.toBe(bindings2.stateTransitions);
        });
    });

    describe('reset', () => {
        it('should reset context to initial state', () => {
            // Modify state
            manager.setState('TEMPLATES');
            manager.selectProject('test-project');
            manager.selectTemplate('test.ascii');
            manager.setTemplateScrollOffset(10);
            manager.enterEditMode(['test']);
            manager.exitEditMode(true);

            // Reset
            manager.reset();

            // Verify initial state
            const data = manager.getData();
            expect(data.state).toBe('PROJECTS');
            expect(data.selectedProjectId).toBeNull();
            expect(data.selectedTemplateFile).toBeNull();
            expect(data.templateScrollOffset).toBe(0);
            expect(data.editMode).toBe(false);
            expect(data.editBuffer).toEqual([]);
            expect(data.unsavedChanges).toBe(false);
            expect(data.testResults).toBeNull();
            expect(data.gitStatus).toBeNull();
        });
    });

    describe('custom bindings', () => {
        it('should load custom bindings from file', () => {
            const customBindings = {
                bindings: [
                    { label: 'A', action: 'custom_action', target: 'PROJECTS' }
                ],
                stateTransitions: {
                    PROJECTS: { A: 'PROJECTS' },
                    TEMPLATES: { A: 'PROJECTS' },
                    BINDINGS: { A: 'PROJECTS' },
                    TEST: { A: 'PROJECTS' },
                    GIT: { A: 'PROJECTS' }
                }
            };

            const bindingsPath = join(tempDir, 'custom-bindings.json');
            writeFileSync(bindingsPath, JSON.stringify(customBindings));

            const customManager = new ManagerStateManager(bindingsPath);
            const bindings = customManager.getBindings();

            expect(bindings.bindings).toHaveLength(1);
            expect(bindings.bindings[0].action).toBe('custom_action');
        });

        it('should use default bindings when file does not exist', () => {
            const customManager = new ManagerStateManager('/non/existent/path.json');
            const bindings = customManager.getBindings();

            expect(bindings.bindings.length).toBeGreaterThan(0);
            expect(bindings.stateTransitions.PROJECTS).toBeDefined();
        });

        it('should use default bindings for malformed JSON', () => {
            const bindingsPath = join(tempDir, 'malformed-bindings.json');
            writeFileSync(bindingsPath, '{ invalid json }');

            // Suppress console.error for this test
            const originalError = console.error;
            console.error = () => {};

            try {
                const customManager = new ManagerStateManager(bindingsPath);
                const bindings = customManager.getBindings();

                expect(bindings.bindings.length).toBeGreaterThan(0);
            } finally {
                console.error = originalError;
            }
        });
    });
});
