// sync/ai-refiner.js
// AI Site Refiner — applies natural language refinements to an existing site.
// Part of CMS Phase 5.3 — AI Site Architect
//
// Takes a current site state + natural language instruction and applies
// targeted changes. Only changes what's needed, preserves everything else.

import { THEME_PRESETS, DEFAULT_THEME } from './theme-editor.js';

/**
 * Instruction patterns for parsing natural language refinements.
 * Each pattern maps to a refinement action.
 */
const REFINE_PATTERNS = [
    // Theme changes
    {
        pattern: /(?:switch|change|set|apply)\s+(?:the\s+)?theme\s+(?:to\s+)?(\w+)/i,
        action: 'change-theme',
        extract: (match) => ({ themeName: match[1].toLowerCase() }),
    },
    {
        pattern: /(?:make|set)\s+(?:the\s+)?(?:header|heading)\s+(blue|red|green|yellow|purple|orange|pink|cyan|white|black|dark|light)/i,
        action: 'change-heading-color',
        extract: (match) => ({ color: match[1].toLowerCase() }),
    },
    {
        pattern: /(?:make|set)\s+(?:the\s+)?(?:background|bg)\s+(blue|red|green|yellow|purple|orange|pink|cyan|white|black|dark|light)/i,
        action: 'change-bg-color',
        extract: (match) => ({ color: match[1].toLowerCase() }),
    },
    {
        pattern: /(?:make\s+)?(?:it|the\s+site|everything)?\s*(?:darker|darker theme|dark mode)/i,
        action: 'make-darker',
        extract: () => ({}),
    },
    {
        pattern: /(?:make\s+)?(?:it|the\s+site|everything)?\s*(?:lighter|lighter theme|light mode)/i,
        action: 'make-lighter',
        extract: () => ({}),
    },
    // Page additions
    {
        pattern: /add\s+(?:a\s+)?blog\s*(?:section|page)?/i,
        action: 'add-blog',
        extract: () => ({}),
    },
    {
        pattern: /add\s+(?:a\s+)?(?:contact|form)\s*(?:section|page|form)?/i,
        action: 'add-contact',
        extract: () => ({}),
    },
    {
        pattern: /add\s+(?:a\s+)?about\s*(?:section|page)?/i,
        action: 'add-about',
        extract: () => ({}),
    },
    {
        pattern: /add\s+(?:a\s+)?(?:project|gallery|portfolio)\s*(?:section|page|gallery)?/i,
        action: 'add-gallery',
        extract: () => ({}),
    },
    {
        pattern: /add\s+(?:a\s+)?(\w+)\s*(?:section|page)/i,
        action: 'add-page',
        extract: (match) => ({ pageName: match[1] }),
    },
    // Content changes
    {
        pattern: /(?:rewrite|change|update|revise)\s+(?:the\s+)?(\w+)\s*(?:page|section)?\s*(?:content|text)?\s*(?:to\s+be\s+)?(?:more\s+)?(\w+)/i,
        action: 'rewrite-page',
        extract: (match) => ({ pageName: match[1].toLowerCase(), style: match[2].toLowerCase() }),
    },
    {
        pattern: /(?:rewrite|change|update|revise)\s+(?:the\s+)?about\s*(?:page|section|text)?/i,
        action: 'rewrite-about',
        extract: () => ({}),
    },
    {
        pattern: /(?:make|write)\s+(?:the\s+)?about\s*(?:page|text|section)?\s*(?:more\s+)?(\w+)/i,
        action: 'rewrite-about-style',
        extract: (match) => ({ style: match[1].toLowerCase() }),
    },
    {
        pattern: /(?:make|make\s+it|make\s+the\s+text)\s*(?:more\s+)?(concise|short|brief|long|detailed|professional|casual|friendly|formal)/i,
        action: 'adjust-tone',
        extract: (match) => ({ tone: match[1].toLowerCase() }),
    },
    // Plugin changes
    {
        pattern: /add\s+(?:a\s+)?contact\s*form/i,
        action: 'enable-plugin',
        extract: () => ({ plugin: 'contact-form' }),
    },
    {
        pattern: /add\s+(?:a\s+)?analytics/i,
        action: 'enable-plugin',
        extract: () => ({ plugin: 'analytics' }),
    },
    {
        pattern: /add\s+(?:a\s+)?(?:media|image)\s*gallery/i,
        action: 'enable-plugin',
        extract: () => ({ plugin: 'media-gallery' }),
    },
    // Remove pages
    {
        pattern: /(?:remove|delete)\s+(?:the\s+)?(\w+)\s*(?:page|section)/i,
        action: 'remove-page',
        extract: (match) => ({ pageName: match[1].toLowerCase() }),
    },
];

/**
 * Color name to RGB mapping for theme changes.
 */
const COLOR_MAP = {
    blue: [0, 120, 255, 255],
    red: [255, 60, 60, 255],
    green: [0, 200, 80, 255],
    yellow: [255, 220, 50, 255],
    purple: [160, 80, 255, 255],
    orange: [255, 150, 30, 255],
    pink: [255, 100, 180, 255],
    cyan: [0, 220, 255, 255],
    white: [240, 240, 240, 255],
    black: [10, 10, 10, 255],
    dark: [30, 30, 40, 255],
    light: [200, 200, 210, 255],
};

/**
 * Tone/style adjustments for content rewriting.
 */
const TONE_TEMPLATES = {
    concise: (content) => {
        const lines = content.split('\n').filter(l => l.trim());
        // Keep only headings and first sentence of each paragraph
        return lines.map(line => {
            if (line.startsWith('#')) return line;
            const sentences = line.split(/\.\s+/);
            return sentences.length > 2 ? sentences[0] + '.' : line;
        }).join('\n');
    },
    short: (content) => {
        const lines = content.split('\n').filter(l => l.trim());
        return lines.slice(0, Math.max(3, Math.ceil(lines.length / 2))).join('\n');
    },
    brief: (content) => {
        const lines = content.split('\n').filter(l => l.trim());
        return lines.slice(0, Math.max(2, Math.ceil(lines.length / 3))).join('\n');
    },
    long: (content) => {
        return content + '\n\n### More Details\n\nWe believe in going above and beyond. ' +
            'Our commitment to excellence drives everything we do, ' +
            'and we are always looking for new ways to improve and innovate.';
    },
    detailed: (content) => {
        return content + '\n\n### In Depth\n\n' +
            'Our approach combines cutting-edge technology with time-tested methodologies. ' +
            'We pay attention to every detail, ensuring that the end result exceeds expectations.';
    },
    professional: (content) => {
        return content.replace(/[!?]{2,}/g, m => m.charAt(0))
            .replace(/\b(awesome|amazing|super|really|very|cool)\b/gi, 'exceptional')
            .replace(/\b(great|good|nice)\b/gi, 'excellent');
    },
    casual: (content) => {
        return content.replace(/\b(excellent|exceptional|outstanding)\b/gi, 'great')
            .replace(/Furthermore,/gi, 'Also,')
            .replace(/Therefore,/gi, 'So,');
    },
    friendly: (content) => {
        return content.replace(/\b(excellent|exceptional)\b/gi, 'awesome')
            .replace(/###/g, '### ');
    },
    formal: (content) => {
        return content.replace(/\b(awesome|cool|great|nice)\b/gi, 'commendable')
            .replace(/\b(we're|we've|don't|can't)\b/gi, (m) => ({
                "we're": 'we are', "we've": 'we have', "don't": 'do not', "can't": 'cannot',
            }[m.toLowerCase()] || m));
    },
};

/**
 * AI Site Refiner — applies natural language refinements to an existing site.
 */
export class AiRefiner {
    /**
     * @param {Object} services
     * @param {import('./content-store.js').ContentStore} services.contentStore
     * @param {import('./router.js').Router} services.router
     * @param {import('./theme-editor.js').ThemeEditor} services.themeEditor
     * @param {Object} [options]
     * @param {Function} [options.pluginActivator] - Function to activate plugins by name
     */
    constructor(services, options = {}) {
        this.contentStore = services.contentStore;
        this.router = services.router;
        this.themeEditor = services.themeEditor;
        this.pluginActivator = options.pluginActivator || null;
    }

    /**
     * Apply a natural language refinement instruction to the current site state.
     *
     * @param {string} instruction - Natural language refinement instruction
     * @param {Object} [currentState] - Optional current site state (if omitted, derived from stores)
     * @returns {Object} Changes applied
     */
    refine(instruction, currentState) {
        if (!instruction || typeof instruction !== 'string') {
            throw new Error('instruction is required and must be a string');
        }

        // Parse the instruction to find matching action(s)
        const actions = this._parseInstruction(instruction);

        if (actions.length === 0) {
            return {
                ok: false,
                message: `Could not understand instruction: "${instruction}"`,
                changes: [],
            };
        }

        // Apply each action
        const changes = [];
        for (const { action, params } of actions) {
            try {
                const result = this._applyAction(action, params, currentState);
                if (result) {
                    changes.push(result);
                }
            } catch (err) {
                changes.push({ action, ok: false, error: err.message });
            }
        }

        return {
            ok: true,
            instruction,
            changes,
        };
    }

    /**
     * Parse a natural language instruction into actions.
     * @param {string} instruction
     * @returns {Array<{action: string, params: Object}>}
     */
    _parseInstruction(instruction) {
        const actions = [];

        for (const { pattern, action, extract } of REFINE_PATTERNS) {
            const match = instruction.match(pattern);
            if (match) {
                actions.push({ action, params: extract(match) });
                // Return only the first (most specific) match
                // to avoid generic patterns overriding specific ones
                break;
            }
        }

        return actions;
    }

    /**
     * Apply a single parsed action.
     */
    _applyAction(action, params, currentState) {
        switch (action) {
            case 'change-theme':
                return this._changeTheme(params.themeName);
            case 'change-heading-color':
                return this._changeProperty('headingFg', params.color);
            case 'change-bg-color':
                return this._changeProperty('bg', params.color);
            case 'make-darker':
                return this._makeDarker();
            case 'make-lighter':
                return this._makeLighter();
            case 'add-blog':
                return this._addPage('Blog', 'blog', 'blog-list', ['recent-posts', 'post-list']);
            case 'add-contact':
                return this._addPage('Contact', 'contact', 'full', ['contact-form']);
            case 'add-about':
                return this._addPage('About', 'about', 'full', ['about-text', 'bio']);
            case 'add-gallery':
                return this._addPage('Gallery', 'gallery', 'grid', ['image-gallery', 'project-gallery']);
            case 'add-page':
                return this._addGenericPage(params.pageName);
            case 'rewrite-page':
                return this._rewritePage(params.pageName, params.style);
            case 'rewrite-about':
                return this._rewriteAbout();
            case 'rewrite-about-style':
                return this._rewriteAboutStyle(params.style);
            case 'adjust-tone':
                return this._adjustTone(params.tone);
            case 'enable-plugin':
                return this._enablePlugin(params.plugin);
            case 'remove-page':
                return this._removePage(params.pageName);
            default:
                return { action, ok: false, error: `Unknown action: ${action}` };
        }
    }

    // ── Theme Actions ──────────────────────────────────────────
    _changeTheme(themeName) {
        if (!this.themeEditor) {
            return { action: 'change-theme', ok: false, error: 'No theme editor available' };
        }

        // Try preset first
        if (THEME_PRESETS[themeName]) {
            this.themeEditor.applyPreset(themeName);
            return { action: 'change-theme', ok: true, theme: themeName, method: 'preset' };
        }

        // Try fuzzy match
        const available = Object.keys(THEME_PRESETS);
        const match = available.find(k => k.includes(themeName) || themeName.includes(k));
        if (match) {
            this.themeEditor.applyPreset(match);
            return { action: 'change-theme', ok: true, theme: match, method: 'fuzzy' };
        }

        return { action: 'change-theme', ok: false, error: `Unknown theme: ${themeName}. Available: ${available.join(', ')}` };
    }

    _changeProperty(prop, colorName) {
        if (!this.themeEditor) {
            return { action: `change-${prop}`, ok: false, error: 'No theme editor available' };
        }
        const rgb = COLOR_MAP[colorName];
        if (!rgb) {
            return { action: `change-${prop}`, ok: false, error: `Unknown color: ${colorName}` };
        }
        this.themeEditor.setProperty(prop, rgb);
        return { action: `change-${prop}`, ok: true, property: prop, color: colorName };
    }

    _makeDarker() {
        if (!this.themeEditor) {
            return { action: 'make-darker', ok: false, error: 'No theme editor available' };
        }
        const theme = this.themeEditor.getTheme();
        // Darken background
        const bg = theme.bg.map((v, i) => i < 3 ? Math.max(0, Math.floor(v * 0.5)) : v);
        // Darken foreground slightly
        const fg = theme.fg.map((v, i) => i < 3 ? Math.max(60, Math.floor(v * 0.8)) : v);
        this.themeEditor.setProperty('bg', bg);
        this.themeEditor.setProperty('fg', fg);
        return { action: 'make-darker', ok: true };
    }

    _makeLighter() {
        if (!this.themeEditor) {
            return { action: 'make-lighter', ok: false, error: 'No theme editor available' };
        }
        const theme = this.themeEditor.getTheme();
        // Lighten background
        const bg = theme.bg.map((v, i) => i < 3 ? Math.min(255, Math.floor(v + (255 - v) * 0.5)) : v);
        this.themeEditor.setProperty('bg', bg);
        return { action: 'make-lighter', ok: true };
    }

    // ── Page Actions ───────────────────────────────────────────
    _addPage(title, slug, layout, sections) {
        // Check if page already exists
        const existing = this._findManifestBySlug(slug);
        if (existing) {
            return { action: 'add-page', ok: false, error: `Page "${slug}" already exists` };
        }

        // Create content items
        const contentIds = [];
        for (const section of sections) {
            const content = this.contentStore.create({
                type: 'page',
                title: `${title} — ${section}`,
                body: `## ${section.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}\n\nContent for the ${title} page.`,
                metadata: { section, page: slug },
            });
            contentIds.push(content.id);
        }

        // Build layout
        const layoutRegions = [
            { region: 'header', contentId: null, inline: '[NAVIGATION]', formula: null },
        ];
        const bodyRegion = { region: 'body', contentId: contentIds[0] || null, inline: null, formula: null };
        layoutRegions.push(bodyRegion);
        layoutRegions.push({ region: 'footer', contentId: null, inline: '[FOOTER]', formula: null });

        const manifest = this.contentStore.createManifest({
            title,
            slug,
            layout: layoutRegions,
            metadata: { layout, sections, contentIds },
        });

        this.router.addRoute(slug, manifest);

        // Auto-enable relevant plugin
        const pluginMap = { 'contact': 'contact-form', 'blog': 'content-editor', 'gallery': 'media-gallery' };
        const pluginName = pluginMap[slug];
        if (pluginName && this.pluginActivator) {
            try { this.pluginActivator(pluginName); } catch (e) { /* ignore */ }
        }

        return {
            action: 'add-page',
            ok: true,
            page: { title, slug, id: manifest.id },
            plugin: pluginName || null,
        };
    }

    _addGenericPage(pageName) {
        const title = pageName.charAt(0).toUpperCase() + pageName.slice(1);
        const slug = pageName.toLowerCase().replace(/\s+/g, '-');
        return this._addPage(title, slug, 'full', [slug]);
    }

    _removePage(pageName) {
        const slug = pageName.toLowerCase().replace(/\s+/g, '-');
        const manifest = this._findManifestBySlug(slug);

        if (!manifest) {
            return { action: 'remove-page', ok: false, error: `Page "${pageName}" not found` };
        }

        this.router.removeRoute(slug);
        this.contentStore.deleteManifest(manifest.id);

        return { action: 'remove-page', ok: true, page: { title: manifest.title, slug } };
    }

    // ── Content Actions ────────────────────────────────────────
    _rewritePage(pageName, style) {
        const slug = pageName.toLowerCase();
        const manifest = this._findManifestBySlug(slug);
        if (!manifest) {
            return { action: 'rewrite-page', ok: false, error: `Page "${pageName}" not found` };
        }
        return this._rewriteManifestContent(manifest, style);
    }

    _rewriteAbout() {
        const manifest = this._findManifestBySlug('about');
        if (!manifest) {
            return { action: 'rewrite-about', ok: false, error: 'About page not found' };
        }
        return this._rewriteManifestContent(manifest, 'professional');
    }

    _rewriteAboutStyle(style) {
        const manifest = this._findManifestBySlug('about');
        if (!manifest) {
            return { action: 'rewrite-about-style', ok: false, error: 'About page not found' };
        }
        return this._rewriteManifestContent(manifest, style);
    }

    _rewriteManifestContent(manifest, style) {
        const changes = [];
        for (const region of manifest.layout) {
            if (region.contentId) {
                const item = this.contentStore.read(region.contentId);
                if (item) {
                    const toneFn = TONE_TEMPLATES[style];
                    const newBody = toneFn ? toneFn(item.body) : item.body;
                    this.contentStore.update(region.contentId, { body: newBody });
                    changes.push({ contentId: region.contentId, updated: true });
                }
            }
        }
        return { action: 'rewrite-page', ok: true, page: manifest.slug, changes };
    }

    _adjustTone(tone) {
        // Apply tone adjustment to ALL page content
        const manifests = this.contentStore.listManifests();
        const changes = [];

        for (const manifest of manifests) {
            for (const region of manifest.layout) {
                if (region.contentId) {
                    const item = this.contentStore.read(region.contentId);
                    if (item) {
                        const toneFn = TONE_TEMPLATES[tone];
                        const newBody = toneFn ? toneFn(item.body) : item.body;
                        this.contentStore.update(region.contentId, { body: newBody });
                        changes.push({ contentId: region.contentId, updated: true });
                    }
                }
            }
        }

        return { action: 'adjust-tone', ok: true, tone, pagesAffected: changes.length };
    }

    // ── Plugin Actions ─────────────────────────────────────────
    _enablePlugin(pluginName) {
        if (this.pluginActivator) {
            try {
                this.pluginActivator(pluginName);
            } catch (err) {
                return { action: 'enable-plugin', ok: false, error: err.message };
            }
        }
        return { action: 'enable-plugin', ok: true, plugin: pluginName };
    }

    // ── Helpers ────────────────────────────────────────────────
    _findManifestBySlug(slug) {
        const manifests = this.contentStore.listManifests();
        return manifests.find(m => m.slug === slug) || null;
    }
}

/**
 * Exported for testing.
 */
export { REFINE_PATTERNS, COLOR_MAP, TONE_TEMPLATES };
