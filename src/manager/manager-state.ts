/**
 * State Manager for ASCII World
 *
 * Manages the manager's own state, selected project, and view context.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export type ManagerState = 'PROJECTS' | 'TEMPLATES' | 'BINDINGS' | 'TEST' | 'GIT' | 'PROJECT_VIEW' | 'DASHBOARD';

export interface TestResults {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    duration: number;
    failedTests: Array<{
        name: string;
        error: string;
    }>;
    lastRun: number;
}

export interface GitStatus {
    branch: string;
    ahead: number;
    behind: number;
    staged: string[];
    unstaged: string[];
    untracked: string[];
    lastCommit: {
        hash: string;
        message: string;
        author: string;
        date: string;
    };
}

export interface DashboardHealth {
    projectId: string;
    projectName: string;
    port: number;
    status: 'running' | 'stopped' | 'error';
    uptime: string | null;
    lastCheck: string | null;
    responseTime: number | null;
}

export interface ManagerContext {
    state: ManagerState;
    selectedProjectId: string | null;
    selectedTemplateFile: string | null;
    templateScrollOffset: number;
    testResults: TestResults | null;
    gitStatus: GitStatus | null;
    dashboardHealth: DashboardHealth[] | null;
    lastHealthCheck: number | null;
    editMode: boolean;
    editBuffer: string[];
    unsavedChanges: boolean;
}

interface Binding {
    label: string;
    action: string;
    target: string | null;
}

interface ManagerBindings {
    bindings: Binding[];
    stateTransitions: Record<ManagerState, Record<string, string>>;
}

/**
 * ManagerStateManager
 *
 * Handles the manager's own state machine. Tracks:
 * - Current state (which view)
 * - Selected project
 * - Selected template file
 * - Test results
 * - Git status
 * - Edit mode state
 */
export class ManagerStateManager {
    private _context: ManagerContext;
    private bindings: ManagerBindings;

    constructor(bindingsPath?: string) {
        const defaultBindingsPath = join(import.meta.dir, '..', 'ascii', 'manager-bindings.json');
        const path = bindingsPath || defaultBindingsPath;

        this.bindings = this.loadBindings(path);

        this._context = {
            state: 'PROJECTS',
            selectedProjectId: null,
            selectedTemplateFile: null,
            templateScrollOffset: 0,
            testResults: null,
            gitStatus: null,
            dashboardHealth: null,
            lastHealthCheck: null,
            editMode: false,
            editBuffer: [],
            unsavedChanges: false
        };
    }

    private loadBindings(path: string): ManagerBindings {
        if (!existsSync(path)) {
            // Return default bindings if file doesn't exist
            return this.getDefaultBindings();
        }

        try {
            const rawData = readFileSync(path, 'utf8');
            return JSON.parse(rawData) as ManagerBindings;
        } catch (error) {
            console.error(`Failed to load bindings from ${path}:`, error);
            return this.getDefaultBindings();
        }
    }

    private getDefaultBindings(): ManagerBindings {
        return {
            bindings: [
                { label: 'A', action: 'goto_projects', target: 'PROJECTS' },
                { label: 'B', action: 'goto_templates', target: 'TEMPLATES' },
                { label: 'C', action: 'goto_bindings', target: 'BINDINGS' },
                { label: 'D', action: 'goto_test', target: 'TEST' },
                { label: 'E', action: 'goto_git', target: 'GIT' },
                { label: 'F', action: 'goto_dashboard', target: 'DASHBOARD' },
                { label: 'X', action: 'quit', target: 'QUIT' }
            ],
            stateTransitions: {
                PROJECTS: { A: 'PROJECTS', B: 'TEMPLATES', C: 'BINDINGS', D: 'TEST', E: 'GIT', F: 'DASHBOARD', X: 'QUIT' },
                TEMPLATES: { A: 'PROJECTS', B: 'TEMPLATES', C: 'BINDINGS', D: 'TEST', E: 'GIT', F: 'DASHBOARD', X: 'QUIT' },
                BINDINGS: { A: 'PROJECTS', B: 'TEMPLATES', C: 'BINDINGS', D: 'TEST', E: 'GIT', F: 'DASHBOARD', X: 'QUIT' },
                TEST: { A: 'PROJECTS', B: 'TEMPLATES', C: 'BINDINGS', D: 'TEST', E: 'GIT', F: 'DASHBOARD', X: 'QUIT' },
                GIT: { A: 'PROJECTS', B: 'TEMPLATES', C: 'BINDINGS', D: 'TEST', E: 'GIT', F: 'DASHBOARD', X: 'QUIT' },
                PROJECT_VIEW: { A: 'PROJECTS', X: 'PROJECTS' },
                DASHBOARD: { A: 'PROJECTS', F: 'DASHBOARD', X: 'QUIT' }
            }
        };
    }

    /**
     * Get the current state
     */
    public getState(): ManagerState {
        return this._context.state;
    }

    /**
     * Set the current state
     */
    public setState(state: ManagerState): void {
        this._context = {
            ...this._context,
            state
        };
    }

    /**
     * Handle an action by label
     * Returns the action result with success status and action name
     */
    public handleAction(label: string): { success: boolean; action?: string; error?: string } {
        const stateTransitions = this.bindings.stateTransitions[this._context.state];

        if (!stateTransitions || !stateTransitions[label]) {
            // Check for non-navigation actions (like select_item_1, start_project, etc.)
            const binding = this.bindings.bindings.find((b: Binding) => b.label === label);
            if (binding) {
                return { success: true, action: binding.action };
            }
            return { success: false, error: `No action for label [${label}] in state ${this._context.state}` };
        }

        const targetState = stateTransitions[label];

        // Handle QUIT
        if (targetState === 'QUIT') {
            return { success: true, action: 'quit' };
        }

        // Handle state transitions - use type narrowing instead of hardcoded array
        if (this.isValidManagerState(targetState)) {
            this._context = {
                ...this._context,
                state: targetState
            };
            const actionMap: Record<ManagerState, string> = {
                'PROJECTS': 'goto_projects',
                'TEMPLATES': 'goto_templates',
                'BINDINGS': 'goto_bindings',
                'TEST': 'goto_test',
                'GIT': 'goto_git',
                'PROJECT_VIEW': 'goto_project_view',
                'DASHBOARD': 'goto_dashboard'
            };
            return { success: true, action: actionMap[targetState] };
        }

        return { success: true, action: 'unknown' };
    }

    /**
     * Type guard to check if a string is a valid ManagerState
     */
    private isValidManagerState(state: string): state is ManagerState {
        return state === 'PROJECTS' || state === 'TEMPLATES' || state === 'BINDINGS' || state === 'TEST' || state === 'GIT' || state === 'PROJECT_VIEW' || state === 'DASHBOARD';
    }

    /**
     * Select a project by ID
     */
    public selectProject(projectId: string): void {
        this._context = {
            ...this._context,
            selectedProjectId: projectId
        };
    }

    /**
     * Clear the selected project
     */
    public clearSelectedProject(): void {
        this._context = {
            ...this._context,
            selectedProjectId: null
        };
    }

    /**
     * Enter project view mode for a specific project
     */
    public enterProjectView(projectId: string): void {
        this._context = {
            ...this._context,
            state: 'PROJECT_VIEW',
            selectedProjectId: projectId
        };
    }

    /**
     * Select a template file
     */
    public selectTemplate(templateFile: string): void {
        this._context = {
            ...this._context,
            selectedTemplateFile: templateFile,
            templateScrollOffset: 0
        };
    }

    /**
     * Clear the selected template
     */
    public clearSelectedTemplate(): void {
        this._context = {
            ...this._context,
            selectedTemplateFile: null,
            templateScrollOffset: 0
        };
    }

    /**
     * Scroll the template view
     */
    public scrollTemplate(direction: 'up' | 'down'): void {
        if (direction === 'up' && this._context.templateScrollOffset > 0) {
            this._context = {
                ...this._context,
                templateScrollOffset: this._context.templateScrollOffset - 1
            };
        } else if (direction === 'down') {
            this._context = {
                ...this._context,
                templateScrollOffset: this._context.templateScrollOffset + 1
            };
        }
    }

    /**
     * Set the template scroll offset directly
     */
    public setTemplateScrollOffset(offset: number): void {
        this._context = {
            ...this._context,
            templateScrollOffset: Math.max(0, offset)
        };
    }

    /**
     * Enter edit mode with the given lines
     */
    public enterEditMode(lines: string[]): void {
        this._context = {
            ...this._context,
            editMode: true,
            editBuffer: [...lines]
        };
    }

    /**
     * Exit edit mode
     * @param save If true, mark that there are unsaved changes
     */
    public exitEditMode(save: boolean): void {
        this._context = {
            ...this._context,
            editMode: false,
            unsavedChanges: save ? true : this._context.unsavedChanges
        };
    }

    /**
     * Update the edit buffer
     */
    public updateEditBuffer(lines: string[]): void {
        this._context = {
            ...this._context,
            editBuffer: [...lines]
        };
    }

    /**
     * Mark changes as saved
     */
    public markChangesSaved(): void {
        this._context = {
            ...this._context,
            unsavedChanges: false
        };
    }

    /**
     * Set test results (creates a deep copy to maintain immutability)
     */
    public setTestResults(results: TestResults): void {
        this._context = {
            ...this._context,
            testResults: {
                ...results,
                failedTests: results.failedTests.map(test => ({ ...test }))
            }
        };
    }

    /**
     * Clear test results
     */
    public clearTestResults(): void {
        this._context = {
            ...this._context,
            testResults: null
        };
    }

    /**
     * Set git status (creates a deep copy to maintain immutability)
     */
    public setGitStatus(status: GitStatus): void {
        this._context = {
            ...this._context,
            gitStatus: {
                ...status,
                staged: [...status.staged],
                unstaged: [...status.unstaged],
                untracked: [...status.untracked],
                lastCommit: { ...status.lastCommit }
            }
        };
    }

    /**
     * Clear git status
     */
    public clearGitStatus(): void {
        this._context = {
            ...this._context,
            gitStatus: null
        };
    }

    /**
     * Set dashboard health data (creates a deep copy to maintain immutability)
     */
    public setDashboardHealth(health: DashboardHealth[]): void {
        this._context = {
            ...this._context,
            dashboardHealth: health.map(h => ({ ...h })),
            lastHealthCheck: Date.now()
        };
    }

    /**
     * Clear dashboard health data
     */
    public clearDashboardHealth(): void {
        this._context = {
            ...this._context,
            dashboardHealth: null,
            lastHealthCheck: null
        };
    }

    /**
     * Get the current context (returns a copy to maintain immutability)
     */
    public getData(): ManagerContext {
        return {
            ...this._context,
            editBuffer: [...this._context.editBuffer],
            dashboardHealth: this._context.dashboardHealth?.map(h => ({ ...h })) ?? null
        };
    }

    /**
     * Get the bindings configuration (creates a deep copy to maintain immutability)
     */
    public getBindings(): ManagerBindings {
        const deepCopyStateTransitions = (): Record<ManagerState, Record<string, string>> => {
            const copy: Record<ManagerState, Record<string, string>> = {} as Record<ManagerState, Record<string, string>>;
            for (const state of Object.keys(this.bindings.stateTransitions) as ManagerState[]) {
                copy[state] = { ...this.bindings.stateTransitions[state] };
            }
            return copy;
        };

        return {
            bindings: this.bindings.bindings.map(b => ({ ...b })),
            stateTransitions: deepCopyStateTransitions()
        };
    }

    /**
     * Reset the context to initial state
     */
    public reset(): void {
        this._context = {
            state: 'PROJECTS',
            selectedProjectId: null,
            selectedTemplateFile: null,
            templateScrollOffset: 0,
            testResults: null,
            gitStatus: null,
            dashboardHealth: null,
            lastHealthCheck: null,
            editMode: false,
            editBuffer: [],
            unsavedChanges: false
        };
    }
}
