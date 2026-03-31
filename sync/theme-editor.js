// sync/theme-editor.js
// Interactive theme editor that overlays on the rendered page.
// Keyboard-driven: tab between properties, arrows to adjust colors.
// Supports save/load/reset of custom themes, and live preview rendering.

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import {
    isValidRGB, parseHex, toHex, nearestColorIndex,
    PRESET_COLORS, PALETTE_256, ansi256Fg, ansi256Bg, ansiTrueFg, ANSI_RESET,
    ColorPicker,
} from './color-picker.js';

/**
 * @typedef {Object} ThemeColors
 * @property {number[]} fg          - Default foreground
 * @property {number[]} bg          - Default background
 * @property {number[]} border      - Border color
 * @property {number[]} borderHighlight - Highlighted border
 * @property {number[]} activeFg    - Active/selected foreground
 * @property {number[]} activeBg    - Active/selected background
 * @property {number[]} focusFg     - Focus foreground
 * @property {number[]} focusBg     - Focus background
 * @property {number[]} titleFg     - Title text color
 * @property {number[]} titleBg     - Title background
 * @property {number[]} linkFg      - Link color
 * @property {number[]} headingFg   - Heading color
 */

/**
 * Default terminal theme (dark mode).
 */
export const DEFAULT_THEME = {
    name: 'default',
    fg: [200, 200, 200, 255],
    bg: [10, 10, 18, 255],
    border: [60, 60, 80, 255],
    borderHighlight: [0, 200, 255, 255],
    activeFg: [0, 255, 255, 255],
    activeBg: [20, 20, 35, 255],
    focusFg: [0, 0, 0, 255],
    focusBg: [0, 200, 255, 255],
    titleFg: [0, 255, 255, 255],
    titleBg: [10, 10, 18, 255],
    linkFg: [100, 200, 255, 255],
    headingFg: [255, 200, 100, 255],
    borderStyle: 'single',     // 'single' | 'double' | 'rounded' | 'bold' | 'none'
    effects: {
        scanlines: false,
        glow: false,
        shadow: false,
    },
};

/**
 * Border character sets for different styles.
 */
export const BORDER_CHARS = {
    single:  { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
    double:  { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
    bold:    { tl: '▛', tr: '▜', bl: '▙', br: '▟', h: '▀', v: '█' },
    none:    { tl: ' ', tr: ' ', bl: ' ', br: ' ', h: ' ', v: ' ' },
};

/**
 * Named theme presets.
 */
export const THEME_PRESETS = {
    default: { ...DEFAULT_THEME },
    midnight: {
        ...DEFAULT_THEME,
        name: 'midnight',
        fg: [180, 180, 220, 255],
        bg: [5, 5, 30, 255],
        border: [40, 40, 100, 255],
        borderHighlight: [80, 80, 255, 255],
        activeFg: [100, 100, 255, 255],
        titleFg: [100, 150, 255, 255],
        linkFg: [80, 120, 255, 255],
    },
    terminal: {
        ...DEFAULT_THEME,
        name: 'terminal',
        fg: [0, 255, 0, 255],
        bg: [0, 0, 0, 255],
        border: [0, 180, 0, 255],
        borderHighlight: [0, 255, 0, 255],
        activeFg: [0, 255, 0, 255],
        titleFg: [0, 255, 100, 255],
        linkFg: [0, 200, 100, 255],
    },
    amber: {
        ...DEFAULT_THEME,
        name: 'amber',
        fg: [255, 176, 0, 255],
        bg: [20, 10, 0, 255],
        border: [180, 120, 0, 255],
        borderHighlight: [255, 200, 50, 255],
        activeFg: [255, 200, 50, 255],
        titleFg: [255, 220, 100, 255],
        linkFg: [255, 180, 50, 255],
    },
    solarized: {
        ...DEFAULT_THEME,
        name: 'solarized',
        fg: [131, 148, 150, 255],
        bg: [0, 43, 54, 255],
        border: [7, 54, 66, 255],
        borderHighlight: [38, 139, 210, 255],
        activeFg: [42, 161, 152, 255],
        titleFg: [181, 137, 0, 255],
        linkFg: [38, 139, 210, 255],
    },
};

/**
 * Theme editor — manages interactive theme customization.
 * Emits events when properties change for live preview.
 */
export class ThemeEditor extends EventEmitter {
    /**
     * @param {Object} [options]
     * @param {Object} [options.theme] - Initial theme (defaults to DEFAULT_THEME)
     * @param {string} [options.themesDir] - Directory for saving/loading themes
     */
    constructor(options = {}) {
        super();
        this.theme = this._deepClone(options.theme || DEFAULT_THEME);
        this._savedTheme = this._deepClone(this.theme);
        this.themesDir = options.themesDir || './themes';

        // Editable properties (in order for tab cycling)
        this._colorProps = [
            'fg', 'bg', 'border', 'borderHighlight',
            'activeFg', 'activeBg', 'focusFg', 'focusBg',
            'titleFg', 'titleBg', 'linkFg', 'headingFg',
        ];

        this._propIndex = 0;
        this._borderStyleIndex = ['single', 'double', 'rounded', 'bold', 'none'].indexOf(
            this.theme.borderStyle || 'single'
        );
        this._borderStyles = ['single', 'double', 'rounded', 'bold', 'none'];

        // Effect toggles
        this._effectIndex = 0;
        this._effectNames = ['scanlines', 'glow', 'shadow'];

        // Edit section: 'colors' | 'border' | 'effects' | 'presets'
        this.section = 'colors';

        // Preset cycling
        this._presetNames = Object.keys(THEME_PRESETS);
        this._presetIndex = 0;

        // Color cycling within current property
        this._colorStep = 8; // Step size for arrow key adjustments
    }

    // ── Public API ────────────────────────────────────────────

    /**
     * Get the current theme.
     * @returns {Object}
     */
    getTheme() {
        return this._deepClone(this.theme);
    }

    /**
     * Set the entire theme.
     * @param {Object} theme
     */
    setTheme(theme) {
        this.theme = this._deepClone({ ...DEFAULT_THEME, ...theme });
        this._emitChange('theme-set');
    }

    /**
     * Set a single theme property.
     * @param {string} prop - Property name
     * @param {*} value - New value
     */
    setProperty(prop, value) {
        if (this._colorProps.includes(prop)) {
            if (!isValidRGB(value)) {
                throw new Error(`Invalid RGB value for ${prop}`);
            }
            this.theme[prop] = [...value];
        } else if (prop === 'borderStyle') {
            if (!BORDER_CHARS[value]) {
                throw new Error(`Invalid border style: ${value}`);
            }
            this.theme.borderStyle = value;
        } else if (prop === 'name') {
            this.theme.name = value;
        } else if (prop.startsWith('effects.')) {
            const key = prop.replace('effects.', '');
            if (key in this.theme.effects) {
                this.theme.effects[key] = Boolean(value);
            }
        }
        this._emitChange('property-changed', { prop, value });
    }

    /**
     * Get the currently focused property name.
     * @returns {string}
     */
    getCurrentProperty() {
        if (this.section === 'colors') {
            return this._colorProps[this._propIndex] || 'fg';
        }
        if (this.section === 'border') {
            return 'borderStyle';
        }
        if (this.section === 'effects') {
            return `effects.${this._effectNames[this._effectIndex] || 'scanlines'}`;
        }
        return '';
    }

    /**
     * Handle a keyboard event for the editor.
     * @param {Object} keyEvent
     * @param {string} keyEvent.name - Key name
     * @returns {Object} Action taken
     */
    handleKey(keyEvent) {
        const { name } = keyEvent;

        // Global keys
        if (name === 'tab') {
            return this._handleTab();
        }
        if (name === 's' && keyEvent.ctrl) {
            this.save();
            return { action: 'save' };
        }
        if (name === 'escape') {
            return { action: 'cancel' };
        }

        // Section-specific keys
        if (this.section === 'colors') {
            return this._handleColorKey(name, keyEvent);
        }
        if (this.section === 'border') {
            return this._handleBorderKey(name);
        }
        if (this.section === 'effects') {
            return this._handleEffectKey(name);
        }
        if (this.section === 'presets') {
            return this._handlePresetKey(name);
        }
        return { action: 'none' };
    }

    /**
     * Save the current theme.
     * @returns {Object} The saved theme
     */
    save() {
        this._savedTheme = this._deepClone(this.theme);
        this._emitChange('save', { theme: this._savedTheme });
        return this._deepClone(this._savedTheme);
    }

    /**
     * Reset to the last saved theme.
     * @returns {Object} The restored theme
     */
    reset() {
        this.theme = this._deepClone(this._savedTheme);
        this._propIndex = 0;
        this._borderStyleIndex = this._borderStyles.indexOf(this.theme.borderStyle || 'single');
        this._emitChange('reset');
        return this._deepClone(this.theme);
    }

    /**
     * Reset to the built-in default theme.
     * @returns {Object}
     */
    resetToDefault() {
        this.theme = this._deepClone(DEFAULT_THEME);
        this._propIndex = 0;
        this._borderStyleIndex = 0;
        this._emitChange('reset-to-default');
        return this._deepClone(this.theme);
    }

    /**
     * Apply a named preset.
     * @param {string} name
     * @returns {boolean}
     */
    applyPreset(name) {
        if (!THEME_PRESETS[name]) return false;
        this.theme = this._deepClone({ ...DEFAULT_THEME, ...THEME_PRESETS[name] });
        this._borderStyleIndex = this._borderStyles.indexOf(this.theme.borderStyle || 'single');
        this._emitChange('preset-applied', { name });
        return true;
    }

    /**
     * Get the border characters for the current theme.
     * @returns {Object}
     */
    getBorderChars() {
        return BORDER_CHARS[this.theme.borderStyle] || BORDER_CHARS.single;
    }

    /**
     * Get an array of editable property info (for rendering).
     * @returns {Object[]}
     */
    getPropertiesList() {
        const list = [];
        for (const prop of this._colorProps) {
            list.push({
                name: prop,
                value: this.theme[prop],
                hex: toHex(this.theme[prop]),
                focused: this.section === 'colors' && this._colorProps[this._propIndex] === prop,
            });
        }
        return list;
    }

    /**
     * Render the editor overlay as a string.
     * @param {Object} [options]
     * @param {number} [options.width=60] - Overlay width
     * @param {number} [options.height=20] - Overlay height
     * @returns {string}
     */
    renderOverlay(options = {}) {
        const width = options.width || 60;
        const height = options.height || 20;
        const bc = this.getBorderChars();
        const lines = [];

        const hLine = bc.h.repeat(width - 2);

        // Title bar
        lines.push(`${bc.tl}${hLine}${bc.tr}`);
        const title = ' Theme Editor ';
        const padL = Math.floor((width - 2 - title.length) / 2);
        const padR = width - 2 - title.length - padL;
        lines.push(`${bc.v}${' '.repeat(padL)}${title}${' '.repeat(padR)}${bc.v}`);
        lines.push(`${bc.v}${hLine}${bc.v}`);

        // Section tabs
        const sections = ['colors', 'border', 'effects', 'presets'];
        let tabLine = '';
        for (const s of sections) {
            const active = this.section === s;
            const label = active ? `[${s}]` : ` ${s} `;
            tabLine += label + ' ';
        }
        tabLine = tabLine.padEnd(width - 2);
        lines.push(`${bc.v}${tabLine.substring(0, width - 2)}${bc.v}`);
        lines.push(`${bc.v}${hLine}${bc.v}`);

        // Content area
        const contentHeight = height - 6; // title(3) + tabs(2) + bottom(1)
        const contentLines = this._renderSectionContent(width);
        for (let i = 0; i < contentHeight; i++) {
            const line = (contentLines[i] || '').padEnd(width - 2);
            lines.push(`${bc.v}${line.substring(0, width - 2)}${bc.v}`);
        }

        // Bottom border
        lines.push(`${bc.bl}${hLine}${bc.br}`);

        // Footer with key hints
        const footer = ' Tab:next  Arrows:adjust  Ctrl+S:save  Esc:cancel ';
        lines.push(footer.substring(0, width));

        return lines.join('\n');
    }

    /**
     * Render the theme as an ANSI-styled preview.
     * @returns {string}
     */
    renderPreview() {
        const bc = this.getBorderChars();
        const t = this.theme;
        const bgIdx = nearestColorIndex(t.bg);
        const fgIdx = nearestColorIndex(t.fg);
        const borderIdx = nearestColorIndex(t.border);
        const titleIdx = nearestColorIndex(t.titleFg);

        const lines = [];

        // Border top
        lines.push(ansi256Fg(borderIdx) + bc.tl + bc.h.repeat(38) + bc.tr + ANSI_RESET);

        // Title
        const title = ' Theme Preview ';
        const padT = Math.floor((38 - title.length) / 2);
        lines.push(
            ansi256Fg(borderIdx) + bc.v + ANSI_RESET +
            ' '.repeat(padT) +
            ansi256Fg(titleIdx) + title + ANSI_RESET +
            ' '.repeat(38 - title.length - padT) +
            ansi256Fg(borderIdx) + bc.v + ANSI_RESET
        );

        // Separator
        lines.push(ansi256Fg(borderIdx) + bc.v + bc.h.repeat(38) + bc.v + ANSI_RESET);

        // Sample content
        const content = [
            '  Normal text sample',
            `  ${ansi256Fg(nearestColorIndex(t.headingFg))}Heading Text${ANSI_RESET}`,
            `  ${ansi256Fg(nearestColorIndex(t.linkFg))}Link Text${ANSI_RESET}`,
            `  ${ansi256Fg(nearestColorIndex(t.activeFg))}Active Text${ANSI_RESET}`,
            `  ${ansi256Bg(nearestColorIndex(t.focusBg))}${ansi256Fg(nearestColorIndex(t.focusFg))} Focus Text ${ANSI_RESET}`,
        ];

        for (const line of content) {
            const padded = line.padEnd(38);
            lines.push(
                ansi256Fg(borderIdx) + bc.v + ANSI_RESET +
                padded.substring(0, 38) +
                ansi256Fg(borderIdx) + bc.v + ANSI_RESET
            );
        }

        // Border bottom
        lines.push(ansi256Fg(borderIdx) + bc.bl + bc.h.repeat(38) + bc.br + ANSI_RESET);

        // Effects labels
        const fx = t.effects;
        const fxLine = `Effects: scanlines=${fx.scanlines ? 'ON' : 'OFF'} glow=${fx.glow ? 'ON' : 'OFF'} shadow=${fx.shadow ? 'ON' : 'OFF'}`;
        lines.push(fxLine);

        return lines.join('\n');
    }

    // ── File I/O ───────────────────────────────────────────────

    /**
     * Save current theme to a JSON file.
     * @param {string} [filename] - File name (default: 'custom.json')
     * @returns {Object} The saved theme
     */
    saveToFile(filename = 'custom.json') {
        const filePath = path.join(this.themesDir, filename);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const data = this._deepClone(this.theme);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        this._savedTheme = this._deepClone(this.theme);
        this._emitChange('save-to-file', { path: filePath });
        return data;
    }

    /**
     * Load a theme from a JSON file.
     * @param {string} [filename] - File name (default: 'custom.json')
     * @returns {Object} The loaded theme
     * @throws {Error} If file not found or invalid JSON
     */
    loadFromFile(filename = 'custom.json') {
        const filePath = path.join(this.themesDir, filename);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Theme file not found: ${filePath}`);
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        this.theme = this._deepClone({ ...DEFAULT_THEME, ...data });
        this._savedTheme = this._deepClone(this.theme);
        this._borderStyleIndex = this._borderStyles.indexOf(this.theme.borderStyle || 'single');
        this._emitChange('load-from-file', { path: filePath });
        return this._deepClone(this.theme);
    }

    /**
     * List available theme files in the themes directory.
     * @returns {string[]} Array of theme file names
     */
    listThemeFiles() {
        if (!fs.existsSync(this.themesDir)) return [];
        return fs.readdirSync(this.themesDir)
            .filter(f => f.endsWith('.json'))
            .sort();
    }

    /**
     * Load a theme from file by name (without .json extension).
     * @param {string} name - Theme name
     * @returns {Object|null} The loaded theme, or null if not found
     */
    loadNamedTheme(name) {
        const filename = `${name}.json`;
        try {
            return this.loadFromFile(filename);
        } catch {
            return null;
        }
    }

    // ── Color Picker Integration ───────────────────────────────

    /**
     * Get a ColorPicker initialized for the current property.
     * @returns {ColorPicker}
     */
    getPickerForCurrentProperty() {
        const prop = this.getCurrentProperty();
        const currentColor = this._colorProps.includes(prop)
            ? this.theme[prop]
            : [200, 200, 200, 255];
        return new ColorPicker({ initial: currentColor.slice(0, 3) });
    }

    /**
     * Apply a color from the picker to the current property.
     * @param {number[]} rgb - RGB color from picker
     * @param {string} [prop] - Property name (defaults to current)
     */
    applyPickerColor(rgb, prop) {
        const target = prop || this.getCurrentProperty();
        if (this._colorProps.includes(target) && isValidRGB(rgb)) {
            this.theme[target] = [...rgb];
            this._emitChange('picker-color-applied', { prop: target, value: rgb });
        }
    }

    // ── Effect Rendering ───────────────────────────────────────

    /**
     * Apply visual effects to a text string.
     * @param {string} text - Input text
     * @returns {string} Text with effects applied
     */
    applyEffects(text) {
        const fx = this.theme.effects;
        const lines = text.split('\n');
        const result = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if (fx.scanlines && i % 2 === 1) {
                // Dim every other line for scanline effect
                line = '\x1b[2m' + line + ANSI_RESET;
            }

            if (fx.glow) {
                // Add subtle highlight to simulate glow
                line = ansiTrueFg(this.theme.borderHighlight.slice(0, 3)) + '\x1b[1m' + line + ANSI_RESET;
            }

            if (fx.shadow) {
                // Prepend shadow offset
                line = '\x1b[38;2;0;0;0m' + line + ANSI_RESET;
            }

            result.push(line);
        }

        return result.join('\n');
    }

    /**
     * Render a preview showing the effects applied.
     * @returns {string}
     */
    renderEffectsPreview() {
        const sample = [
            '┌──────────────────────┐',
            '│  Sample Effects Box  │',
            '├──────────────────────┤',
            '│  Line 1              │',
            '│  Line 2              │',
            '│  Line 3              │',
            '│  Line 4              │',
            '└──────────────────────┘',
        ].join('\n');

        return this.applyEffects(sample);
    }

    // ── Theme Diff ─────────────────────────────────────────────

    /**
     * Compute differences between current and saved theme.
     * @returns {Object[]} Array of {prop, current, saved} diffs
     */
    diff() {
        const diffs = [];
        const allProps = [
            ...this._colorProps, 'borderStyle', 'name',
            'effects.scanlines', 'effects.glow', 'effects.shadow',
        ];

        for (const prop of allProps) {
            let current, saved;
            if (prop.startsWith('effects.')) {
                const key = prop.replace('effects.', '');
                current = this.theme.effects[key];
                saved = this._savedTheme.effects[key];
            } else {
                current = this.theme[prop];
                saved = this._savedTheme[prop];
            }

            if (JSON.stringify(current) !== JSON.stringify(saved)) {
                diffs.push({ prop, current, saved });
            }
        }

        return diffs;
    }

    /**
     * Check if the current theme has unsaved changes.
     * @returns {boolean}
     */
    isDirty() {
        return this.diff().length > 0;
    }

    /**
     * Export the current theme as a JSON string.
     * @returns {string}
     */
    exportJSON() {
        return JSON.stringify(this.theme, null, 2);
    }

    /**
     * Import a theme from a JSON string.
     * @param {string} json - JSON string
     * @returns {Object} The imported theme
     * @throws {Error} If invalid JSON
     */
    importJSON(json) {
        const data = JSON.parse(json);
        this.setTheme(data);
        return this.getTheme();
    }

    // ── Theme Merge ────────────────────────────────────────────

    /**
     * Merge partial theme properties into the current theme.
     * @param {Object} partial - Partial theme properties
     */
    merge(partial) {
        for (const [key, value] of Object.entries(partial)) {
            if (key === 'effects' && typeof value === 'object') {
                Object.assign(this.theme.effects, value);
            } else if (this._colorProps.includes(key) && isValidRGB(value)) {
                this.theme[key] = [...value];
            } else if (key === 'borderStyle' && BORDER_CHARS[value]) {
                this.theme.borderStyle = value;
            } else if (key === 'name') {
                this.theme.name = value;
            }
        }
        this._emitChange('merge', { partial });
    }

    // ── Private Helpers ────────────────────────────────────────

    _handleTab() {
        const sections = ['colors', 'border', 'effects', 'presets'];
        const currentIdx = sections.indexOf(this.section);
        if (currentIdx < sections.length - 1) {
            this.section = sections[currentIdx + 1];
        } else {
            this.section = sections[0];
        }
        // Reset sub-indices
        this._propIndex = 0;
        this._effectIndex = 0;
        this._presetIndex = 0;
        this._emitChange('section-changed', { section: this.section });
        return { action: 'section-changed', section: this.section };
    }

    _handleColorKey(name, keyEvent) {
        const prop = this._colorProps[this._propIndex];
        if (!prop) return { action: 'none' };

        if (name === 'up') {
            // Cycle up through property list
            this._propIndex = (this._propIndex - 1 + this._colorProps.length) % this._colorProps.length;
            this._emitChange('property-focus', { prop: this._colorProps[this._propIndex] });
            return { action: 'property-focus', prop: this._colorProps[this._propIndex] };
        }
        if (name === 'down') {
            this._propIndex = (this._propIndex + 1) % this._colorProps.length;
            this._emitChange('property-focus', { prop: this._colorProps[this._propIndex] });
            return { action: 'property-focus', prop: this._colorProps[this._propIndex] };
        }

        // Color adjustment with left/right
        if (name === 'right' || name === 'left') {
            const step = keyEvent.shift ? this._colorStep * 2 : this._colorStep;
            const rgb = [...this.theme[prop]];
            const channel = keyEvent.ctrl ? 2 : keyEvent.alt ? 1 : 0; // R / G / B
            if (name === 'right') {
                rgb[channel] = Math.min(255, rgb[channel] + step);
            } else {
                rgb[channel] = Math.max(0, rgb[channel] - step);
            }
            this.theme[prop] = rgb;
            this._emitChange('color-adjusted', { prop, value: rgb });
            return { action: 'color-adjusted', prop, value: rgb };
        }

        return { action: 'none' };
    }

    _handleBorderKey(name) {
        if (name === 'left') {
            this._borderStyleIndex = (this._borderStyleIndex - 1 + this._borderStyles.length) % this._borderStyles.length;
        } else if (name === 'right') {
            this._borderStyleIndex = (this._borderStyleIndex + 1) % this._borderStyles.length;
        } else {
            return { action: 'none' };
        }
        const style = this._borderStyles[this._borderStyleIndex];
        this.theme.borderStyle = style;
        this._emitChange('border-changed', { style });
        return { action: 'border-changed', style };
    }

    _handleEffectKey(name) {
        if (name === 'up') {
            this._effectIndex = (this._effectIndex - 1 + this._effectNames.length) % this._effectNames.length;
            return { action: 'effect-focus', effect: this._effectNames[this._effectIndex] };
        }
        if (name === 'down') {
            this._effectIndex = (this._effectIndex + 1) % this._effectNames.length;
            return { action: 'effect-focus', effect: this._effectNames[this._effectIndex] };
        }
        if (name === 'right' || name === 'left' || name === 'enter' || name === 'space') {
            const effect = this._effectNames[this._effectIndex];
            this.theme.effects[effect] = !this.theme.effects[effect];
            this._emitChange('effect-toggled', { effect, value: this.theme.effects[effect] });
            return { action: 'effect-toggled', effect, value: this.theme.effects[effect] };
        }
        return { action: 'none' };
    }

    _handlePresetKey(name) {
        if (name === 'up') {
            this._presetIndex = (this._presetIndex - 1 + this._presetNames.length) % this._presetNames.length;
            return { action: 'preset-focus', preset: this._presetNames[this._presetIndex] };
        }
        if (name === 'down') {
            this._presetIndex = (this._presetIndex + 1) % this._presetNames.length;
            return { action: 'preset-focus', preset: this._presetNames[this._presetIndex] };
        }
        if (name === 'enter' || name === 'right') {
            const preset = this._presetNames[this._presetIndex];
            this.applyPreset(preset);
            return { action: 'preset-applied', preset };
        }
        return { action: 'none' };
    }

    _renderSectionContent(width) {
        const lines = [];

        if (this.section === 'colors') {
            const props = this.getPropertiesList();
            for (const p of props) {
                const cursor = p.focused ? '>' : ' ';
                const idx = nearestColorIndex(p.value);
                const line = `${cursor} ${p.name.padEnd(16)} ${p.hex} `;
                const colorBlock = ansi256Bg(idx) + '    ' + ANSI_RESET;
                lines.push(line + colorBlock);
            }
        } else if (this.section === 'border') {
            const style = this.theme.borderStyle || 'single';
            const bc = BORDER_CHARS[style];
            lines.push(`  Border Style: ${style}`);
            lines.push('');
            lines.push(`  Preview:`);
            lines.push(`  ${bc.tl}${bc.h.repeat(20)}${bc.tr}`);
            lines.push(`  ${bc.v}${' '.repeat(20)}${bc.v}`);
            lines.push(`  ${bc.bl}${bc.h.repeat(20)}${bc.br}`);
            lines.push('');
            lines.push('  < > to change style');
        } else if (this.section === 'effects') {
            const fx = this.theme.effects;
            const names = this._effectNames;
            for (let i = 0; i < names.length; i++) {
                const cursor = i === this._effectIndex ? '>' : ' ';
                const effect = names[i];
                const state = fx[effect] ? 'ON ' : 'OFF';
                lines.push(`${cursor} ${effect.padEnd(12)} [${state}]`);
            }
            lines.push('');
            lines.push('  Enter/Space to toggle');
        } else if (this.section === 'presets') {
            for (let i = 0; i < this._presetNames.length; i++) {
                const cursor = i === this._presetIndex ? '>' : ' ';
                const name = this._presetNames[i];
                const isCurrent = name === this.theme.name;
                const marker = isCurrent ? ' *' : '';
                lines.push(`${cursor} ${name}${marker}`);
            }
            lines.push('');
            lines.push('  Enter to apply preset');
        }

        return lines;
    }

    _emitChange(type, detail = {}) {
        this.emit('change', { type, ...detail, theme: this._deepClone(this.theme) });
    }

    _deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
}
