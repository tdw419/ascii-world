/**
 * ASCII Template Generator
 *
 * Renders ASCII templates with Mustache-style variable substitution.
 * Supports:
 * - {{variable}} - Simple variable substitution
 * - {{#each collection}}...{{/each}} - Iterate over arrays
 * - {{#if condition}}...{{/if}} - Conditional rendering
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Template data structure - can contain primitives, arrays, and nested objects
 */
export type TemplateData = Record<string, unknown>;

/**
 * Cache entry for loaded templates
 */
interface CacheEntry {
    content: string;
    loadedAt: number;
}

/**
 * Default template used when a requested template is not found
 */
const DEFAULT_TEMPLATE = `╔══════════════════════════════════════════════════════════════════════════════╗
║  ASCII INTERFACE MANAGER                                   v{{app_version}}  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Projects  [B] Templates  [C] Bindings  [D] Test  [E] Git  [X] Quit     ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  Template not found: {{state}}                                              ║
║                                                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

/**
 * AsciiGenerator
 *
 * Handles loading, caching, and rendering of ASCII templates with Mustache-style syntax.
 */
export class AsciiGenerator {
    private templateCache: Map<string, CacheEntry> = new Map();
    private templatesPath: string;

    /**
     * Create a new AsciiGenerator
     * @param templatesPath Optional path to templates directory (defaults to src/ascii/states)
     */
    constructor(templatesPath?: string) {
        this.templatesPath = templatesPath || join(import.meta.dir, '..', 'ascii', 'states');
    }

    /**
     * Render a template for a given state with the provided data
     * @param state The state name (e.g., 'projects', 'templates', 'bindings')
     * @param data The data to use for variable substitution
     * @returns The rendered ASCII template string
     */
    public render(state: string, data: TemplateData): string {
        const template = this.loadTemplate(state);
        return this.processTemplate(template, data);
    }

    /**
     * Load a template from file or cache
     * @param state The state name
     * @returns The template content
     */
    private loadTemplate(state: string): string {
        const normalizedState = state.toLowerCase();
        const templateFile = join(this.templatesPath, `${normalizedState}.ascii`);

        // Check cache first
        const cached = this.templateCache.get(normalizedState);
        if (cached) {
            return cached.content;
        }

        // Try to load from file
        if (existsSync(templateFile)) {
            try {
                const content = readFileSync(templateFile, 'utf8');
                // Cache the loaded template
                this.templateCache.set(normalizedState, {
                    content,
                    loadedAt: Date.now()
                });
                return content;
            } catch (error) {
                console.error(`Failed to load template ${templateFile}:`, error);
                return this.getDefaultTemplate();
            }
        }

        // Return default template if file doesn't exist
        return this.getDefaultTemplate();
    }

    /**
     * Process a template with the given data
     * @param template The raw template string
     * @param data The data for substitution
     * @returns The processed template string
     */
    private processTemplate(template: string, data: TemplateData): string {
        let result = template;

        // Process in order: conditionals, each blocks, then variables
        // This ensures proper nesting behavior
        result = this.processConditionals(result, data);
        result = this.processEachBlocks(result, data);
        result = this.processVariables(result, data);

        return result;
    }

    /**
     * Process simple variable substitutions: {{variable}}
     * Supports nested paths like {{user.name}}
     * @param template The template string
     * @param data The data object
     * @returns The template with variables substituted
     */
    private processVariables(template: string, data: TemplateData): string {
        // Match {{variable}} patterns, excluding block tags
        const variablePattern = /\{\{([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}\}/g;

        return template.replace(variablePattern, (match, path: string) => {
            const value = this.getNestedValue(data, path);
            return value !== undefined && value !== null ? String(value) : '';
        });
    }

    /**
     * Process each blocks: {{#each collection}}...{{/each}}
     * @param template The template string
     * @param data The data object
     * @returns The template with each blocks processed
     */
    private processEachBlocks(template: string, data: TemplateData): string {
        // Match {{#each name}}...{{/each}} blocks
        const eachPattern = /\{\{#each\s+([a-zA-Z_][a-zA-Z0-9_]*)\}\}([\s\S]*?)\{\{\/each\}\}/g;

        return template.replace(eachPattern, (match, collectionName: string, innerTemplate: string) => {
            const collection = this.getNestedValue(data, collectionName);

            if (!Array.isArray(collection) || collection.length === 0) {
                return '';
            }

            // Process each item in the collection
            return collection.map((item, index) => {
                // Create a context with the item's properties plus index
                const itemContext: TemplateData = {
                    ...data,
                    ...item,
                    '@index': index,
                    '@first': index === 0,
                    '@last': index === collection.length - 1
                };

                // Process variables in the inner template for this item
                let result = innerTemplate;
                result = this.processConditionals(result, itemContext);
                result = this.processVariables(result, itemContext);
                return result;
            }).join('');
        });
    }

    /**
     * Process conditional blocks: {{#if condition}}...{{/if}}
     * @param template The template string
     * @param data The data object
     * @returns The template with conditionals processed
     */
    private processConditionals(template: string, data: TemplateData): string {
        // Match {{#if condition}}...{{/if}} blocks
        const ifPattern = /\{\{#if\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\}\}([\s\S]*?)\{\{\/if\}\}/g;

        return template.replace(ifPattern, (match, conditionPath: string, innerTemplate: string) => {
            const value = this.getNestedValue(data, conditionPath);
            const isTruthy = this.isTruthy(value);

            if (isTruthy) {
                // Process nested content
                let result = innerTemplate;
                result = this.processConditionals(result, data);
                result = this.processEachBlocks(result, data);
                result = this.processVariables(result, data);
                return result;
            }

            return '';
        });
    }

    /**
     * Get a nested value from an object using dot notation
     * @param obj The object to get the value from
     * @param path The dot-notation path (e.g., 'user.profile.name')
     * @returns The value at the path, or undefined if not found
     */
    private getNestedValue(obj: TemplateData, path: string): unknown {
        const parts = path.split('.');
        let current: unknown = obj;

        for (const part of parts) {
            if (current === null || current === undefined) {
                return undefined;
            }

            if (typeof current === 'object' && part in current) {
                current = (current as Record<string, unknown>)[part];
            } else {
                return undefined;
            }
        }

        return current;
    }

    /**
     * Check if a value is truthy for conditional evaluation
     * @param value The value to check
     * @returns True if the value is truthy
     */
    private isTruthy(value: unknown): boolean {
        if (value === null || value === undefined) {
            return false;
        }
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        if (typeof value === 'string') {
            return value.length > 0;
        }
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        if (typeof value === 'object') {
            return Object.keys(value).length > 0;
        }
        return Boolean(value);
    }

    /**
     * Get the default template used when a template is not found
     * @returns The default template string
     */
    public getDefaultTemplate(): string {
        return DEFAULT_TEMPLATE;
    }

    /**
     * Clear the template cache
     * Useful when templates are updated and need to be reloaded
     */
    public clearCache(): void {
        this.templateCache.clear();
    }

    /**
     * Clear a specific template from the cache
     * @param state The state name to clear from cache
     */
    public clearCacheFor(state: string): void {
        this.templateCache.delete(state.toLowerCase());
    }

    /**
     * Get the current cache size
     * @returns Number of cached templates
     */
    public getCacheSize(): number {
        return this.templateCache.size;
    }

    /**
     * Preload a template into the cache
     * @param state The state name to preload
     * @returns True if the template was loaded successfully
     */
    public preloadTemplate(state: string): boolean {
        const normalizedState = state.toLowerCase();
        const templateFile = join(this.templatesPath, `${normalizedState}.ascii`);

        if (existsSync(templateFile)) {
            try {
                const content = readFileSync(templateFile, 'utf8');
                this.templateCache.set(normalizedState, {
                    content,
                    loadedAt: Date.now()
                });
                return true;
            } catch {
                return false;
            }
        }

        return false;
    }

    /**
     * Preload all known templates into the cache
     * @param states Array of state names to preload
     * @returns Number of templates successfully loaded
     */
    public preloadTemplates(states: string[]): number {
        let loaded = 0;
        for (const state of states) {
            if (this.preloadTemplate(state)) {
                loaded++;
            }
        }
        return loaded;
    }
}

// Export a singleton instance for convenience
let defaultGenerator: AsciiGenerator | null = null;

/**
 * Get the default AsciiGenerator instance
 * @param templatesPath Optional path to templates directory
 * @returns The default AsciiGenerator instance
 */
export function getAsciiGenerator(templatesPath?: string): AsciiGenerator {
    if (!defaultGenerator) {
        defaultGenerator = new AsciiGenerator(templatesPath);
    }
    return defaultGenerator;
}

/**
 * Reset the default generator (useful for testing)
 */
export function resetAsciiGenerator(): void {
    defaultGenerator = null;
}
