import { readFileSync } from 'fs';
import { join } from 'path';
import { StateManager, Task, Settings } from './state-manager';

export class AsciiGenerator {
    private templates: Map<string, string> = new Map();

    constructor() {
        this.loadTemplates();
    }

    private loadTemplates() {
        const statesDir = join(import.meta.dir, '..', 'ascii', 'states');
        const states = ['home', 'tasks', 'settings'];
        
        for (const state of states) {
            const path = join(statesDir, `${state}.ascii`);
            try {
                this.templates.set(state.toUpperCase(), readFileSync(path, 'utf8'));
            } catch (e) {
                console.error(`Failed to load template for ${state}:`, e);
            }
        }
    }

    public render(stateManager: StateManager): string {
        const data = stateManager.getData();
        let template = this.templates.get(data.state);

        if (!template) {
            return `Error: No template found for state ${data.state}`;
        }

        // Basic variable replacement
        template = template.replace(/{{timestamp}}/g, new Date().toISOString());
        template = template.replace(/{{status}}/g, 'READY');
        template = template.replace(/{{task_count}}/g, data.tasks.length.toString());
        template = template.replace(/{{active_count}}/g, data.tasks.filter(t => !t.completed).length.toString());
        template = template.replace(/{{total_count}}/g, data.tasks.length.toString());
        template = template.replace(/{{last_run}}/g, 'Never');
        template = template.replace(/{{uptime}}/g, `${Math.floor(process.uptime())}s`);

        // Settings replacements
        if (data.state === 'SETTINGS') {
            template = template.replace(/{{app_name}}/g, 'ASCII Reference App');
            template = template.replace(/{{auto_save_enabled}}/g, data.settings.autoSave ? '[X] ON ' : '[ ] OFF');
            template = template.replace(/{{current_theme}}/g, data.settings.theme.toUpperCase());
            template = template.replace(/{{current_language}}/g, 'English');
            template = template.replace(/{{api_endpoint}}/g, 'http://localhost:3421');
            template = template.replace(/{{model_id}}/g, 'gpt-4');
            template = template.replace(/{{max_tokens}}/g, '2048');
        }

        // Handle loops (very basic implementation for tasks)
        if (template.includes('{{#each tasks}}')) {
            const parts = template.split(/{{#each tasks}}|{{\/each}}/);
            if (parts.length === 3) {
                const before = parts[0];
                const eachPart = parts[1];
                const after = parts[2];

                const renderedTasks = data.tasks.map((task, index) => {
                    let item = eachPart;
                    item = item.replace(/{{label}}/g, String.fromCharCode(65 + index)); // A, B, C...
                    item = item.replace(/{{status_icon}}/g, task.completed ? '[X]' : '[ ]');
                    item = item.replace(/{{description}}/g, task.title.padEnd(40, ' '));
                    item = item.replace(/{{priority}}/g, task.priority.toUpperCase().padEnd(8, ' '));
                    item = item.replace(/{{due}}/g, 'ASAP');
                    return item;
                }).join('');

                template = before + renderedTasks + after;
            }
        }

        return template;
    }
}
