import { readFileSync } from 'fs';
import { join } from 'path';

export type AppState = 'HOME' | 'TASKS' | 'SETTINGS' | 'TASK_EDIT';

export interface Task {
    id: string;
    title: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
}

export interface Settings {
    autoSave: boolean;
    theme: 'dark' | 'light';
    notifications: boolean;
}

export class StateManager {
    public currentState: AppState = 'HOME';
    public tasks: Task[] = [
        { id: '1', title: 'Implement State Manager', completed: true, priority: 'high' },
        { id: '2', title: 'Build ASCII Generator', completed: false, priority: 'medium' },
        { id: '3', title: 'Expose Control API', completed: false, priority: 'low' },
    ];
    public settings: Settings = {
        autoSave: true,
        theme: 'dark',
        notifications: true,
    };

    private bindings: any;

    constructor() {
        const bindingsPath = join(import.meta.dir, '..', 'ascii', 'bindings.json');
        this.bindings = JSON.parse(readFileSync(bindingsPath, 'utf8'));
    }

    public handleAction(label: string): boolean {
        const stateTransitions = this.bindings.stateTransitions[this.currentState];
        if (!stateTransitions || !stateTransitions[label]) {
            console.warn(`No action for label [${label}] in state ${this.currentState}`);
            return false;
        }

        const action = stateTransitions[label];
        console.log(`Action for label [${label}]: ${action}`);

        // Simple state machine logic
        switch (action) {
            case 'goto_tasks':
            case 'TASKS':
                this.currentState = 'TASKS';
                break;
            case 'goto_settings':
            case 'SETTINGS':
                this.currentState = 'SETTINGS';
                break;
            case 'back_home':
            case 'BACK_home':
            case 'HOME':
                this.currentState = 'HOME';
                break;
            case 'TASK_EDIT':
                this.currentState = 'TASK_EDIT';
                break;
            case 'toggle_auto_save':
                this.settings.autoSave = !this.settings.autoSave;
                break;
            case 'toggle_current_theme':
                this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
                break;
            case 'toggle_notifications':
                this.settings.notifications = !this.settings.notifications;
                break;
            case 'TOGGLE_PRIORITY':
                // For demo purposes, toggle the first task's priority
                const p = this.tasks[0].priority;
                this.tasks[0].priority = p === 'low' ? 'medium' : p === 'medium' ? 'high' : 'low';
                break;
            case 'remove_task':
                this.tasks.shift();
                break;
            case 'new_task':
                this.tasks.push({
                    id: String(this.tasks.length + 1),
                    title: `New Task ${this.tasks.length + 1}`,
                    completed: false,
                    priority: 'medium',
                });
                break;
            case 'quit':
                process.exit(0);
                break;
            default:
                console.warn(`Action [${action}] logic not implemented yet.`);
                return false;
        }

        return true;
    }

    public getData() {
        return {
            state: this.currentState,
            tasks: this.tasks,
            settings: this.settings,
        };
    }
}
