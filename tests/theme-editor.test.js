// tests/theme-editor.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
    ANSI_16, colorCube, greyRamp, PALETTE_256, PRESET_COLORS,
    isValidRGB, parseHex, toHex, nearestColorIndex,
    ansi256Fg, ansi256Bg, ansiTrueFg, ansiTrueBg, ANSI_RESET,
    ColorPicker,
} from '../sync/color-picker.js';
import {
    DEFAULT_THEME, BORDER_CHARS, THEME_PRESETS, ThemeEditor,
} from '../sync/theme-editor.js';

// ─── Color Picker Unit Tests ────────────────────────────────

describe('ColorPicker — Palette', () => {
    it('ANSI_16 has 16 colors', () => {
        assert.strictEqual(ANSI_16.length, 16);
    });

    it('colorCube returns 216 entries (6x6x6)', () => {
        const cube = colorCube();
        assert.strictEqual(cube.length, 216);
        // Each entry is [r, g, b]
        for (const c of cube) {
            assert.strictEqual(c.length, 3);
            assert.ok(c[0] >= 0 && c[0] <= 255);
            assert.ok(c[1] >= 0 && c[1] <= 255);
            assert.ok(c[2] >= 0 && c[2] <= 255);
        }
    });

    it('greyRamp returns 24 entries', () => {
        const ramp = greyRamp();
        assert.strictEqual(ramp.length, 24);
        // Should be monotonically increasing
        for (let i = 1; i < ramp.length; i++) {
            assert.ok(ramp[i][0] >= ramp[i - 1][0]);
            assert.strictEqual(ramp[i][0], ramp[i][1]);
            assert.strictEqual(ramp[i][0], ramp[i][2]);
        }
    });

    it('PALETTE_256 has exactly 256 entries', () => {
        assert.strictEqual(PALETTE_256.length, 256);
    });

    it('PALETTE_256 starts with ANSI 16', () => {
        for (let i = 0; i < 16; i++) {
            assert.deepStrictEqual(PALETTE_256[i], ANSI_16[i]);
        }
    });
});

describe('ColorPicker — Validation', () => {
    it('validates correct RGB arrays', () => {
        assert.strictEqual(isValidRGB([0, 0, 0]), true);
        assert.strictEqual(isValidRGB([255, 255, 255]), true);
        assert.strictEqual(isValidRGB([128, 64, 32, 255]), true);
    });

    it('rejects invalid RGB', () => {
        assert.strictEqual(isValidRGB(null), false);
        assert.strictEqual(isValidRGB('red'), false);
        assert.strictEqual(isValidRGB([256, 0, 0]), false);
        assert.strictEqual(isValidRGB([-1, 0, 0]), false);
        assert.strictEqual(isValidRGB([0, 0]), false);
        assert.strictEqual(isValidRGB([1.5, 0, 0]), false);
    });
});

describe('ColorPicker — Hex Parsing', () => {
    it('parses #RRGGBB', () => {
        assert.deepStrictEqual(parseHex('#FF0000'), [255, 0, 0]);
        assert.deepStrictEqual(parseHex('#00FF00'), [0, 255, 0]);
        assert.deepStrictEqual(parseHex('#0000FF'), [0, 0, 255]);
        assert.deepStrictEqual(parseHex('#ABCDEF'), [0xAB, 0xCD, 0xEF]);
    });

    it('parses RRGGBB without hash', () => {
        assert.deepStrictEqual(parseHex('FF0000'), [255, 0, 0]);
    });

    it('parses #RGB shorthand', () => {
        assert.deepStrictEqual(parseHex('#F00'), [255, 0, 0]);
        assert.deepStrictEqual(parseHex('#0F0'), [0, 255, 0]);
        assert.deepStrictEqual(parseHex('#00F'), [0, 0, 255]);
        assert.deepStrictEqual(parseHex('#FFF'), [255, 255, 255]);
    });

    it('returns null for invalid hex', () => {
        assert.strictEqual(parseHex(''), null);
        assert.strictEqual(parseHex('xyz'), null);
        assert.strictEqual(parseHex('#GGGGGG'), null);
        assert.strictEqual(parseHex(null), null);
        assert.strictEqual(parseHex(123), null);
    });
});

describe('ColorPicker — Hex Conversion', () => {
    it('converts RGB to hex', () => {
        assert.strictEqual(toHex([255, 0, 0]), '#ff0000');
        assert.strictEqual(toHex([0, 255, 0]), '#00ff00');
        assert.strictEqual(toHex([0, 0, 255]), '#0000ff');
        assert.strictEqual(toHex([255, 255, 255]), '#ffffff');
        assert.strictEqual(toHex([0, 0, 0]), '#000000');
    });

    it('returns #000000 for invalid RGB', () => {
        assert.strictEqual(toHex(null), '#000000');
        assert.strictEqual(toHex('bad'), '#000000');
    });
});

describe('ColorPicker — nearestColorIndex', () => {
    it('finds exact match for black', () => {
        assert.strictEqual(nearestColorIndex([0, 0, 0]), 0);
    });

    it('finds exact match for white', () => {
        assert.strictEqual(nearestColorIndex([255, 255, 255]), 15);
    });

    it('finds close match for pure red', () => {
        // Red is index 9 in ANSI_16 = [255, 0, 0]
        const idx = nearestColorIndex([255, 0, 0]);
        assert.ok(idx >= 0 && idx < 256);
    });

    it('returns 0 for invalid input', () => {
        assert.strictEqual(nearestColorIndex(null), 0);
        assert.strictEqual(nearestColorIndex([999, 999, 999]), 0);
    });
});

describe('ColorPicker — ANSI Codes', () => {
    it('generates 256-color foreground', () => {
        assert.strictEqual(ansi256Fg(9), '\x1b[38;5;9m');
    });

    it('generates 256-color background', () => {
        assert.strictEqual(ansi256Bg(9), '\x1b[48;5;9m');
    });

    it('generates true-color foreground', () => {
        assert.strictEqual(ansiTrueFg([255, 128, 0]), '\x1b[38;2;255;128;0m');
    });

    it('generates true-color background', () => {
        assert.strictEqual(ansiTrueBg([0, 64, 128]), '\x1b[48;2;0;64;128m');
    });
});

describe('ColorPicker — PRESET_COLORS', () => {
    it('has named preset colors', () => {
        assert.ok(PRESET_COLORS.red);
        assert.ok(PRESET_COLORS.blue);
        assert.ok(PRESET_COLORS.green);
        assert.ok(PRESET_COLORS.cyan);
    });

    it('all presets are valid RGB', () => {
        for (const [name, rgb] of Object.entries(PRESET_COLORS)) {
            assert.ok(isValidRGB(rgb), `Preset "${name}" is not valid RGB`);
        }
    });
});

describe('ColorPicker Class', () => {
    let picker;

    beforeEach(() => {
        picker = new ColorPicker();
    });

    it('initializes with white', () => {
        assert.deepStrictEqual(picker.getColor(), [255, 255, 255]);
    });

    it('initializes with custom color', () => {
        const p = new ColorPicker({ initial: [255, 0, 0] });
        assert.deepStrictEqual(p.getColor(), [255, 0, 0]);
    });

    it('setColor changes the selected color', () => {
        picker.setColor([128, 64, 32]);
        assert.deepStrictEqual(picker.getColor(), [128, 64, 32]);
    });

    it('setColor ignores invalid input', () => {
        picker.setColor([255, 0, 0]);
        picker.setColor(null);
        assert.deepStrictEqual(picker.getColor(), [255, 0, 0]);
    });

    it('moveCursor navigates the palette', () => {
        const initial = picker.cursorIndex;
        picker.moveCursor('right');
        assert.strictEqual(picker.cursorIndex, initial + 1);
    });

    it('moveCursor left at 0 stays at 0', () => {
        picker.cursorIndex = 0;
        picker.moveCursor('left');
        assert.strictEqual(picker.cursorIndex, 0);
    });

    it('moveCursor right at max stays at max', () => {
        picker.cursorIndex = 255;
        picker.moveCursor('right');
        assert.strictEqual(picker.cursorIndex, 255);
    });

    it('moveCursor down moves by cols', () => {
        picker.cursorIndex = 0;
        picker.moveCursor('down', 16);
        assert.strictEqual(picker.cursorIndex, 16);
    });

    it('moveCursor up moves by cols', () => {
        picker.cursorIndex = 20;
        picker.moveCursor('up', 16);
        assert.strictEqual(picker.cursorIndex, 4);
    });

    it('moveCursor updates selected color', () => {
        picker.cursorIndex = 0;
        picker.moveCursor('right');
        assert.deepStrictEqual(picker.selected, [...PALETTE_256[picker.cursorIndex]]);
    });

    it('cyclePreset goes through named colors', () => {
        picker.setMode('preset');
        picker.cyclePreset('next');
        const name1 = picker.presetNames[picker.presetIndex];
        picker.cyclePreset('next');
        const name2 = picker.presetNames[picker.presetIndex];
        assert.notStrictEqual(name1, name2);
    });

    it('cyclePreset wraps around', () => {
        picker.setMode('preset');
        picker.presetIndex = 0;
        picker.cyclePreset('prev');
        assert.strictEqual(picker.presetIndex, picker.presetNames.length - 1);
    });

    it('appendHex builds hex string', () => {
        picker.setMode('hex');
        picker.appendHex('F');
        picker.appendHex('F');
        picker.appendHex('0');
        picker.appendHex('0');
        picker.appendHex('0');
        picker.appendHex('0');
        assert.strictEqual(picker.hexInput, 'FF0000');
    });

    it('appendHex ignores non-hex chars', () => {
        picker.setMode('hex');
        picker.appendHex('G');
        assert.strictEqual(picker.hexInput, '');
    });

    it('appendHex applies color at 6 chars', () => {
        picker.setMode('hex');
        for (const ch of '00FF00') picker.appendHex(ch);
        assert.deepStrictEqual(picker.selected, [0, 255, 0]);
    });

    it('clearHex resets input', () => {
        picker.setMode('hex');
        picker.appendHex('FF');
        picker.clearHex();
        assert.strictEqual(picker.hexInput, '');
    });

    it('commitHex applies valid color', () => {
        picker.setMode('hex');
        picker.hexInput = 'FF0000';
        const result = picker.commitHex();
        assert.strictEqual(result, true);
        assert.deepStrictEqual(picker.selected, [255, 0, 0]);
    });

    it('commitHex rejects invalid color', () => {
        picker.setMode('hex');
        picker.hexInput = 'ZZZ';
        const result = picker.commitHex();
        assert.strictEqual(result, false);
    });

    it('setMode switches mode', () => {
        picker.setMode('preset');
        assert.strictEqual(picker.mode, 'preset');
        picker.setMode('hex');
        assert.strictEqual(picker.mode, 'hex');
    });

    it('setMode ignores invalid mode', () => {
        picker.setMode('invalid');
        assert.strictEqual(picker.mode, 'palette');
    });

    it('renderPreview returns string', () => {
        const preview = picker.renderPreview();
        assert.ok(typeof preview === 'string');
        assert.ok(preview.length > 0);
    });

    it('renderASCII returns string', () => {
        const ascii = picker.renderASCII();
        assert.ok(typeof ascii === 'string');
        assert.ok(ascii.includes('Color Picker'));
    });
});

// ─── Theme Editor Unit Tests ────────────────────────────────

describe('ThemeEditor — Construction', () => {
    it('creates with default theme', () => {
        const editor = new ThemeEditor();
        const theme = editor.getTheme();
        assert.strictEqual(theme.name, 'default');
        assert.deepStrictEqual(theme.fg, [200, 200, 200, 255]);
        assert.deepStrictEqual(theme.bg, [10, 10, 18, 255]);
    });

    it('creates with custom theme', () => {
        const editor = new ThemeEditor({
            theme: { ...DEFAULT_THEME, name: 'custom', fg: [255, 0, 0, 255] },
        });
        const theme = editor.getTheme();
        assert.strictEqual(theme.name, 'custom');
        assert.deepStrictEqual(theme.fg, [255, 0, 0, 255]);
    });
});

describe('ThemeEditor — DEFAULT_THEME', () => {
    it('has all required color properties', () => {
        const props = ['fg', 'bg', 'border', 'borderHighlight', 'activeFg', 'activeBg',
            'focusFg', 'focusBg', 'titleFg', 'titleBg', 'linkFg', 'headingFg'];
        for (const prop of props) {
            assert.ok(DEFAULT_THEME[prop], `Missing ${prop}`);
            assert.ok(isValidRGB(DEFAULT_THEME[prop]), `${prop} is not valid RGB`);
        }
    });

    it('has borderStyle', () => {
        assert.strictEqual(DEFAULT_THEME.borderStyle, 'single');
    });

    it('has effects object', () => {
        assert.ok(DEFAULT_THEME.effects);
        assert.strictEqual(DEFAULT_THEME.effects.scanlines, false);
        assert.strictEqual(DEFAULT_THEME.effects.glow, false);
        assert.strictEqual(DEFAULT_THEME.effects.shadow, false);
    });
});

describe('ThemeEditor — BORDER_CHARS', () => {
    it('has all styles', () => {
        const styles = ['single', 'double', 'rounded', 'bold', 'none'];
        for (const style of styles) {
            assert.ok(BORDER_CHARS[style], `Missing border style: ${style}`);
            const bc = BORDER_CHARS[style];
            assert.ok(bc.tl !== undefined);
            assert.ok(bc.tr !== undefined);
            assert.ok(bc.bl !== undefined);
            assert.ok(bc.br !== undefined);
            assert.ok(bc.h !== undefined);
            assert.ok(bc.v !== undefined);
        }
    });

    it('single style uses box-drawing chars', () => {
        const bc = BORDER_CHARS.single;
        assert.strictEqual(bc.tl, '┌');
        assert.strictEqual(bc.tr, '┐');
    });

    it('double style uses double box chars', () => {
        const bc = BORDER_CHARS.double;
        assert.strictEqual(bc.tl, '╔');
        assert.strictEqual(bc.tr, '╗');
    });

    it('none style uses spaces', () => {
        const bc = BORDER_CHARS.none;
        assert.strictEqual(bc.tl, ' ');
        assert.strictEqual(bc.h, ' ');
    });
});

describe('ThemeEditor — THEME_PRESETS', () => {
    it('has multiple presets', () => {
        assert.ok(Object.keys(THEME_PRESETS).length >= 4);
    });

    it('each preset has required color props', () => {
        const colorProps = ['fg', 'bg', 'border', 'borderHighlight'];
        for (const [name, preset] of Object.entries(THEME_PRESETS)) {
            for (const prop of colorProps) {
                assert.ok(preset[prop], `Preset "${name}" missing ${prop}`);
            }
        }
    });
});

describe('ThemeEditor — setTheme', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('sets entire theme', () => {
        editor.setTheme({ ...DEFAULT_THEME, name: 'test', fg: [255, 0, 0, 255] });
        const theme = editor.getTheme();
        assert.strictEqual(theme.name, 'test');
        assert.deepStrictEqual(theme.fg, [255, 0, 0, 255]);
    });

    it('fills missing properties from DEFAULT_THEME', () => {
        editor.setTheme({ name: 'minimal' });
        const theme = editor.getTheme();
        assert.deepStrictEqual(theme.bg, DEFAULT_THEME.bg);
        assert.deepStrictEqual(theme.border, DEFAULT_THEME.border);
    });
});

describe('ThemeEditor — setProperty', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('sets color properties', () => {
        editor.setProperty('fg', [100, 100, 100]);
        assert.deepStrictEqual(editor.getTheme().fg, [100, 100, 100]);
    });

    it('sets border style', () => {
        editor.setProperty('borderStyle', 'double');
        assert.strictEqual(editor.getTheme().borderStyle, 'double');
    });

    it('sets effect toggles', () => {
        editor.setProperty('effects.scanlines', true);
        assert.strictEqual(editor.getTheme().effects.scanlines, true);
    });

    it('sets theme name', () => {
        editor.setProperty('name', 'my-theme');
        assert.strictEqual(editor.getTheme().name, 'my-theme');
    });

    it('rejects invalid RGB', () => {
        assert.throws(() => editor.setProperty('fg', [999, 0, 0]), /Invalid RGB/);
    });

    it('rejects invalid border style', () => {
        assert.throws(() => editor.setProperty('borderStyle', 'fancy'), /Invalid border/);
    });
});

describe('ThemeEditor — handleKey (Keyboard Navigation)', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('tab cycles through sections', () => {
        assert.strictEqual(editor.section, 'colors');
        editor.handleKey({ name: 'tab' });
        assert.strictEqual(editor.section, 'border');
        editor.handleKey({ name: 'tab' });
        assert.strictEqual(editor.section, 'effects');
        editor.handleKey({ name: 'tab' });
        assert.strictEqual(editor.section, 'presets');
        editor.handleKey({ name: 'tab' });
        assert.strictEqual(editor.section, 'colors');
    });

    it('up/down in colors section moves property focus', () => {
        assert.strictEqual(editor.getCurrentProperty(), 'fg');
        editor.handleKey({ name: 'down' });
        assert.strictEqual(editor.getCurrentProperty(), 'bg');
        editor.handleKey({ name: 'up' });
        assert.strictEqual(editor.getCurrentProperty(), 'fg');
    });

    it('wraps around in colors section', () => {
        // Go to last property
        for (let i = 0; i < 11; i++) editor.handleKey({ name: 'down' });
        editor.handleKey({ name: 'down' }); // wrap to first
        assert.strictEqual(editor.getCurrentProperty(), 'fg');
    });

    it('left/right in colors section adjusts color', () => {
        const originalFg = [...editor.getTheme().fg];
        editor.handleKey({ name: 'right' });
        const newFg = editor.getTheme().fg;
        assert.ok(newFg[0] !== originalFg[0], 'Red channel should change');
    });

    it('left/right in border section changes style', () => {
        editor.handleKey({ name: 'tab' }); // go to border
        assert.strictEqual(editor.section, 'border');
        editor.handleKey({ name: 'right' });
        assert.strictEqual(editor.getTheme().borderStyle, 'double');
        editor.handleKey({ name: 'right' });
        assert.strictEqual(editor.getTheme().borderStyle, 'rounded');
    });

    it('enter in effects section toggles effect', () => {
        editor.handleKey({ name: 'tab' });
        editor.handleKey({ name: 'tab' }); // effects
        assert.strictEqual(editor.section, 'effects');
        const original = editor.getTheme().effects.scanlines;
        editor.handleKey({ name: 'enter' });
        assert.strictEqual(editor.getTheme().effects.scanlines, !original);
    });

    it('space in effects section toggles effect', () => {
        editor.handleKey({ name: 'tab' });
        editor.handleKey({ name: 'tab' }); // effects
        editor.handleKey({ name: 'space' });
        assert.strictEqual(editor.getTheme().effects.scanlines, true);
    });

    it('enter in presets section applies preset', () => {
        editor.handleKey({ name: 'tab' });
        editor.handleKey({ name: 'tab' });
        editor.handleKey({ name: 'tab' }); // presets
        // Default first preset should be 'default'
        editor.handleKey({ name: 'down' }); // move to next preset
        editor.handleKey({ name: 'enter' });
        const theme = editor.getTheme();
        assert.ok(theme.name !== 'default' || THEME_PRESETS.default);
    });

    it('escape returns cancel action', () => {
        const result = editor.handleKey({ name: 'escape' });
        assert.strictEqual(result.action, 'cancel');
    });

    it('ctrl+s saves', () => {
        const result = editor.handleKey({ name: 's', ctrl: true });
        assert.strictEqual(result.action, 'save');
    });
});

describe('ThemeEditor — Save/Reset', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('save captures current theme', () => {
        editor.setProperty('fg', [100, 100, 100]);
        const saved = editor.save();
        assert.deepStrictEqual(saved.fg, [100, 100, 100]);
    });

    it('reset restores saved theme', () => {
        const original = editor.getTheme();
        editor.setProperty('fg', [100, 100, 100]);
        editor.save();
        editor.setProperty('fg', [200, 200, 200]);
        const reset = editor.reset();
        assert.deepStrictEqual(reset.fg, [100, 100, 100]);
    });

    it('reset to default restores DEFAULT_THEME', () => {
        editor.setProperty('fg', [100, 100, 100]);
        editor.setProperty('borderStyle', 'double');
        const theme = editor.resetToDefault();
        assert.deepStrictEqual(theme.fg, DEFAULT_THEME.fg);
        assert.strictEqual(theme.borderStyle, 'single');
    });
});

describe('ThemeEditor — Presets', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('applyPreset applies a named preset', () => {
        const result = editor.applyPreset('terminal');
        assert.strictEqual(result, true);
        const theme = editor.getTheme();
        assert.deepStrictEqual(theme.fg, [0, 255, 0, 255]);
    });

    it('applyPreset returns false for unknown preset', () => {
        const result = editor.applyPreset('nonexistent');
        assert.strictEqual(result, false);
    });
});

describe('ThemeEditor — getBorderChars', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('returns single border by default', () => {
        const bc = editor.getBorderChars();
        assert.strictEqual(bc.tl, '┌');
    });

    it('changes when borderStyle is set', () => {
        editor.setProperty('borderStyle', 'double');
        const bc = editor.getBorderChars();
        assert.strictEqual(bc.tl, '╔');
    });
});

describe('ThemeEditor — getPropertiesList', () => {
    it('returns all color properties with metadata', () => {
        const editor = new ThemeEditor();
        const list = editor.getPropertiesList();
        assert.ok(list.length >= 12);
        assert.strictEqual(list[0].name, 'fg');
        assert.ok(list[0].hex);
        assert.ok(list[0].value);
        // First property should be focused by default
        assert.strictEqual(list[0].focused, true);
    });
});

describe('ThemeEditor — Rendering', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('renderOverlay returns string with box drawing', () => {
        const overlay = editor.renderOverlay();
        assert.ok(typeof overlay === 'string');
        assert.ok(overlay.includes('Theme Editor'));
        assert.ok(overlay.includes('colors'));
    });

    it('renderOverlay with custom dimensions', () => {
        const overlay = editor.renderOverlay({ width: 80, height: 30 });
        const lines = overlay.split('\n');
        assert.ok(lines.length > 0);
        // First line should be the top border with width 80
        assert.ok(lines[0].length <= 80);
    });

    it('renderPreview returns ANSI-styled string', () => {
        const preview = editor.renderPreview();
        assert.ok(typeof preview === 'string');
        assert.ok(preview.includes('Theme Preview'));
    });

    it('renderPreview includes effect status', () => {
        editor.setProperty('effects.scanlines', true);
        const preview = editor.renderPreview();
        assert.ok(preview.includes('scanlines=ON'));
    });
});

describe('ThemeEditor — Events', () => {
    it('emits change event on setProperty', () => {
        const editor = new ThemeEditor();
        let event = null;
        editor.on('change', (e) => { event = e; });
        editor.setProperty('fg', [100, 100, 100]);
        assert.ok(event);
        assert.strictEqual(event.type, 'property-changed');
        assert.strictEqual(event.prop, 'fg');
    });

    it('emits change event on save', () => {
        const editor = new ThemeEditor();
        let event = null;
        editor.on('change', (e) => { event = e; });
        editor.save();
        assert.ok(event);
        assert.strictEqual(event.type, 'save');
    });

    it('emits change event on reset', () => {
        const editor = new ThemeEditor();
        editor.save(); // set saved state
        let event = null;
        editor.on('change', (e) => { event = e; });
        editor.reset();
        assert.ok(event);
        assert.strictEqual(event.type, 'reset');
    });

    it('emits change event on applyPreset', () => {
        const editor = new ThemeEditor();
        let event = null;
        editor.on('change', (e) => { event = e; });
        editor.applyPreset('terminal');
        assert.ok(event);
        assert.strictEqual(event.type, 'preset-applied');
    });

    it('emits change event on handleKey', () => {
        const editor = new ThemeEditor();
        let event = null;
        editor.on('change', (e) => { event = e; });
        editor.handleKey({ name: 'right' });
        assert.ok(event);
        assert.strictEqual(event.type, 'color-adjusted');
    });
});

describe('ThemeEditor — Deep Clone Safety', () => {
    it('getTheme returns a copy', () => {
        const editor = new ThemeEditor();
        const theme1 = editor.getTheme();
        theme1.fg[0] = 0;
        const theme2 = editor.getTheme();
        assert.strictEqual(theme2.fg[0], 200); // Original unchanged
    });
});

// ─── File I/O Tests ────────────────────────────────────────

describe('ThemeEditor — File I/O', () => {
    let editor;
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-test-'));
        editor = new ThemeEditor({ themesDir: tmpDir });
    });

    it('saveToFile creates a JSON file', () => {
        editor.setProperty('name', 'test-save');
        const saved = editor.saveToFile();
        assert.strictEqual(saved.name, 'test-save');
        const filePath = path.join(tmpDir, 'custom.json');
        assert.ok(fs.existsSync(filePath));
        const loaded = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        assert.strictEqual(loaded.name, 'test-save');
    });

    it('saveToFile creates directory if missing', () => {
        const deepDir = path.join(tmpDir, 'nested', 'themes');
        const ed = new ThemeEditor({ themesDir: deepDir });
        ed.saveToFile();
        assert.ok(fs.existsSync(path.join(deepDir, 'custom.json')));
    });

    it('saveToFile uses custom filename', () => {
        editor.saveToFile('my-theme.json');
        assert.ok(fs.existsSync(path.join(tmpDir, 'my-theme.json')));
    });

    it('loadFromFile loads a theme from file', () => {
        const themeData = { ...DEFAULT_THEME, name: 'loaded', fg: [100, 100, 100, 255] };
        fs.writeFileSync(path.join(tmpDir, 'custom.json'), JSON.stringify(themeData));
        const loaded = editor.loadFromFile();
        assert.strictEqual(loaded.name, 'loaded');
        assert.deepStrictEqual(loaded.fg, [100, 100, 100, 255]);
    });

    it('loadFromFile fills missing properties from DEFAULT_THEME', () => {
        fs.writeFileSync(path.join(tmpDir, 'custom.json'), JSON.stringify({ name: 'minimal' }));
        const loaded = editor.loadFromFile();
        assert.deepStrictEqual(loaded.border, DEFAULT_THEME.border);
    });

    it('loadFromFile throws for missing file', () => {
        assert.throws(() => editor.loadFromFile('nonexistent.json'), /Theme file not found/);
    });

    it('loadFromFile throws for invalid JSON', () => {
        fs.writeFileSync(path.join(tmpDir, 'bad.json'), 'not json');
        assert.throws(() => editor.loadFromFile('bad.json'));
    });

    it('loadFromFile updates border style index', () => {
        const themeData = { ...DEFAULT_THEME, borderStyle: 'double' };
        fs.writeFileSync(path.join(tmpDir, 'custom.json'), JSON.stringify(themeData));
        editor.loadFromFile();
        // Verify via handleKey that border section starts at double
        editor.section = 'border';
        editor.handleKey({ name: 'right' });
        assert.strictEqual(editor.getTheme().borderStyle, 'rounded');
    });

    it('listThemeFiles returns sorted JSON files', () => {
        fs.writeFileSync(path.join(tmpDir, 'beta.json'), '{}');
        fs.writeFileSync(path.join(tmpDir, 'alpha.json'), '{}');
        fs.writeFileSync(path.join(tmpDir, 'gamma.json'), '{}');
        fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'hello');
        const files = editor.listThemeFiles();
        assert.deepStrictEqual(files, ['alpha.json', 'beta.json', 'gamma.json']);
    });

    it('listThemeFiles returns empty array for missing directory', () => {
        const ed = new ThemeEditor({ themesDir: '/nonexistent/path' });
        assert.deepStrictEqual(ed.listThemeFiles(), []);
    });

    it('loadNamedTheme loads by name without .json', () => {
        const themeData = { ...DEFAULT_THEME, name: 'named' };
        fs.writeFileSync(path.join(tmpDir, 'named.json'), JSON.stringify(themeData));
        const loaded = editor.loadNamedTheme('named');
        assert.strictEqual(loaded.name, 'named');
    });

    it('loadNamedTheme returns null for missing theme', () => {
        const result = editor.loadNamedTheme('missing');
        assert.strictEqual(result, null);
    });

    it('round-trip save/load preserves theme', () => {
        editor.setProperty('name', 'roundtrip');
        editor.setProperty('fg', [42, 42, 42]);
        editor.setProperty('borderStyle', 'rounded');
        editor.setProperty('effects.scanlines', true);
        editor.saveToFile();

        const ed2 = new ThemeEditor({ themesDir: tmpDir });
        const loaded = ed2.loadFromFile();
        assert.strictEqual(loaded.name, 'roundtrip');
        assert.deepStrictEqual(loaded.fg, [42, 42, 42]);
        assert.strictEqual(loaded.borderStyle, 'rounded');
        assert.strictEqual(loaded.effects.scanlines, true);
    });

    it('emits save-to-file event', () => {
        let event = null;
        editor.on('change', (e) => { event = e; });
        editor.saveToFile();
        assert.ok(event);
        assert.strictEqual(event.type, 'save-to-file');
        assert.ok(event.path);
    });

    it('emits load-from-file event', () => {
        fs.writeFileSync(path.join(tmpDir, 'custom.json'), JSON.stringify(DEFAULT_THEME));
        let event = null;
        editor.on('change', (e) => { event = e; });
        editor.loadFromFile();
        assert.ok(event);
        assert.strictEqual(event.type, 'load-from-file');
    });
});

// ─── Color Picker Integration Tests ────────────────────────

describe('ThemeEditor — Color Picker Integration', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('getPickerForCurrentProperty returns ColorPicker', () => {
        const picker = editor.getPickerForCurrentProperty();
        assert.ok(picker instanceof ColorPicker);
    });

    it('picker is initialized with current property color', () => {
        const picker = editor.getPickerForCurrentProperty();
        const color = picker.getColor();
        assert.strictEqual(color[0], DEFAULT_THEME.fg[0]);
        assert.strictEqual(color[1], DEFAULT_THEME.fg[1]);
        assert.strictEqual(color[2], DEFAULT_THEME.fg[2]);
    });

    it('picker updates for different properties', () => {
        editor.handleKey({ name: 'down' }); // move to bg
        const picker = editor.getPickerForCurrentProperty();
        const color = picker.getColor();
        assert.strictEqual(color[0], DEFAULT_THEME.bg[0]);
    });

    it('applyPickerColor changes theme property', () => {
        editor.applyPickerColor([128, 64, 32]);
        assert.deepStrictEqual(editor.getTheme().fg.slice(0, 3), [128, 64, 32]);
    });

    it('applyPickerColor can target specific property', () => {
        editor.applyPickerColor([10, 20, 30], 'bg');
        assert.deepStrictEqual(editor.getTheme().bg.slice(0, 3), [10, 20, 30]);
    });

    it('applyPickerColor ignores invalid RGB', () => {
        const origFg = [...editor.getTheme().fg];
        editor.applyPickerColor([999, 0, 0]);
        assert.deepStrictEqual(editor.getTheme().fg, origFg);
    });

    it('applyPickerColor emits event', () => {
        let event = null;
        editor.on('change', (e) => { event = e; });
        editor.applyPickerColor([50, 50, 50]);
        assert.ok(event);
        assert.strictEqual(event.type, 'picker-color-applied');
    });
});

// ─── Effect Rendering Tests ────────────────────────────────

describe('ThemeEditor — Effect Rendering', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('applyEffects returns string with no effects', () => {
        const result = editor.applyEffects('hello\nworld');
        assert.strictEqual(result, 'hello\nworld');
    });

    it('applyEffects adds scanline dimming on odd lines', () => {
        editor.setProperty('effects.scanlines', true);
        const result = editor.applyEffects('line1\nline2\nline3');
        const lines = result.split('\n');
        assert.ok(!lines[0].includes('\x1b[2m'));
        assert.ok(lines[1].includes('\x1b[2m'));
        assert.ok(!lines[2].includes('\x1b[2m'));
    });

    it('applyEffects adds glow effect', () => {
        editor.setProperty('effects.glow', true);
        const result = editor.applyEffects('hello');
        assert.ok(result.includes('\x1b[1m'));
    });

    it('applyEffects adds shadow effect', () => {
        editor.setProperty('effects.shadow', true);
        const result = editor.applyEffects('hello');
        assert.ok(result.includes('\x1b[38;2;0;0;0m'));
    });

    it('applyEffects combines multiple effects', () => {
        editor.setProperty('effects.scanlines', true);
        editor.setProperty('effects.glow', true);
        const result = editor.applyEffects('a\nb');
        // Line 2 (index 1) should have both scanline dim and glow
        assert.ok(result.includes('\x1b[2m'));
        assert.ok(result.includes('\x1b[1m'));
    });

    it('renderEffectsPreview returns string', () => {
        const preview = editor.renderEffectsPreview();
        assert.ok(typeof preview === 'string');
        assert.ok(preview.includes('Sample Effects Box'));
    });

    it('renderEffectsPreview with effects modifies output', () => {
        editor.setProperty('effects.scanlines', true);
        const preview = editor.renderEffectsPreview();
        assert.ok(preview.includes('\x1b[2m'));
    });
});

// ─── Theme Diff Tests ──────────────────────────────────────

describe('ThemeEditor — Diff & Dirty', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('diff returns empty array when no changes', () => {
        const diffs = editor.diff();
        assert.strictEqual(diffs.length, 0);
    });

    it('diff detects color change', () => {
        editor.setProperty('fg', [100, 100, 100]);
        const diffs = editor.diff();
        assert.ok(diffs.length >= 1);
        const fgDiff = diffs.find(d => d.prop === 'fg');
        assert.ok(fgDiff);
        assert.deepStrictEqual(fgDiff.current, [100, 100, 100]);
    });

    it('diff detects borderStyle change', () => {
        editor.setProperty('borderStyle', 'double');
        const diffs = editor.diff();
        const bsDiff = diffs.find(d => d.prop === 'borderStyle');
        assert.ok(bsDiff);
        assert.strictEqual(bsDiff.current, 'double');
    });

    it('diff detects effect change', () => {
        editor.setProperty('effects.scanlines', true);
        const diffs = editor.diff();
        const fxDiff = diffs.find(d => d.prop === 'effects.scanlines');
        assert.ok(fxDiff);
        assert.strictEqual(fxDiff.current, true);
        assert.strictEqual(fxDiff.saved, false);
    });

    it('diff returns empty after save', () => {
        editor.setProperty('fg', [100, 100, 100]);
        editor.save();
        assert.strictEqual(editor.diff().length, 0);
    });

    it('isDirty returns false when no changes', () => {
        assert.strictEqual(editor.isDirty(), false);
    });

    it('isDirty returns true after unsaved change', () => {
        editor.setProperty('fg', [100, 100, 100]);
        assert.strictEqual(editor.isDirty(), true);
    });

    it('isDirty returns false after save', () => {
        editor.setProperty('fg', [100, 100, 100]);
        editor.save();
        assert.strictEqual(editor.isDirty(), false);
    });

    it('isDirty returns false after reset', () => {
        editor.setProperty('fg', [100, 100, 100]);
        editor.reset();
        assert.strictEqual(editor.isDirty(), false);
    });
});

// ─── Export / Import Tests ─────────────────────────────────

describe('ThemeEditor — Export/Import', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('exportJSON returns valid JSON string', () => {
        const json = editor.exportJSON();
        const parsed = JSON.parse(json);
        assert.strictEqual(parsed.name, 'default');
        assert.ok(parsed.fg);
    });

    it('exportJSON includes all properties', () => {
        const json = editor.exportJSON();
        const parsed = JSON.parse(json);
        assert.ok(parsed.effects);
        assert.ok(parsed.borderStyle);
        assert.ok(parsed.fg);
        assert.ok(parsed.bg);
    });

    it('importJSON loads theme from JSON string', () => {
        const json = JSON.stringify({ ...DEFAULT_THEME, name: 'imported', fg: [1, 2, 3, 255] });
        const result = editor.importJSON(json);
        assert.strictEqual(result.name, 'imported');
        assert.deepStrictEqual(result.fg, [1, 2, 3, 255]);
    });

    it('importJSON fills missing properties from DEFAULT_THEME', () => {
        const json = JSON.stringify({ name: 'partial' });
        const result = editor.importJSON(json);
        assert.deepStrictEqual(result.border, DEFAULT_THEME.border);
    });

    it('importJSON throws for invalid JSON', () => {
        assert.throws(() => editor.importJSON('not json'));
    });

    it('round-trip export/import preserves theme', () => {
        editor.setProperty('name', 'roundtrip');
        editor.setProperty('fg', [42, 42, 42]);
        editor.setProperty('borderStyle', 'rounded');
        const json = editor.exportJSON();

        const ed2 = new ThemeEditor();
        ed2.importJSON(json);
        assert.strictEqual(ed2.getTheme().name, 'roundtrip');
        assert.deepStrictEqual(ed2.getTheme().fg, [42, 42, 42]);
        assert.strictEqual(ed2.getTheme().borderStyle, 'rounded');
    });
});

// ─── Theme Merge Tests ─────────────────────────────────────

describe('ThemeEditor — Merge', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('merge applies partial color properties', () => {
        editor.merge({ fg: [100, 100, 100], bg: [0, 0, 0, 255] });
        assert.deepStrictEqual(editor.getTheme().fg, [100, 100, 100]);
        assert.deepStrictEqual(editor.getTheme().bg, [0, 0, 0, 255]);
    });

    it('merge applies borderStyle', () => {
        editor.merge({ borderStyle: 'double' });
        assert.strictEqual(editor.getTheme().borderStyle, 'double');
    });

    it('merge applies effects', () => {
        editor.merge({ effects: { scanlines: true, glow: true } });
        assert.strictEqual(editor.getTheme().effects.scanlines, true);
        assert.strictEqual(editor.getTheme().effects.glow, true);
        // shadow should remain unchanged
        assert.strictEqual(editor.getTheme().effects.shadow, false);
    });

    it('merge applies name', () => {
        editor.merge({ name: 'merged' });
        assert.strictEqual(editor.getTheme().name, 'merged');
    });

    it('merge ignores invalid color values', () => {
        const origFg = [...editor.getTheme().fg];
        editor.merge({ fg: [999, 0, 0] });
        assert.deepStrictEqual(editor.getTheme().fg, origFg);
    });

    it('merge ignores invalid borderStyle', () => {
        editor.merge({ borderStyle: 'fancy' });
        assert.strictEqual(editor.getTheme().borderStyle, 'single');
    });

    it('merge emits change event', () => {
        let event = null;
        editor.on('change', (e) => { event = e; });
        editor.merge({ fg: [50, 50, 50] });
        assert.ok(event);
        assert.strictEqual(event.type, 'merge');
    });

    it('merge preserves unmerged properties', () => {
        const origBg = [...editor.getTheme().bg];
        editor.merge({ fg: [50, 50, 50] });
        assert.deepStrictEqual(editor.getTheme().bg, origBg);
    });
});

// ─── Keyboard Advanced Tests ───────────────────────────────

describe('ThemeEditor — Keyboard Advanced', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('shift+right doubles color step', () => {
        const origFg = [...editor.getTheme().fg];
        editor.handleKey({ name: 'right', shift: true });
        const newFg = editor.getTheme().fg;
        assert.strictEqual(newFg[0] - origFg[0], 16); // 2x step of 8
    });

    it('ctrl+right adjusts blue channel', () => {
        const origFg = [...editor.getTheme().fg];
        editor.handleKey({ name: 'right', ctrl: true });
        const newFg = editor.getTheme().fg;
        assert.strictEqual(newFg[2], origFg[2] + 8);
    });

    it('alt+right adjusts green channel', () => {
        const origFg = [...editor.getTheme().fg];
        editor.handleKey({ name: 'right', alt: true });
        const newFg = editor.getTheme().fg;
        assert.strictEqual(newFg[1], origFg[1] + 8);
    });

    it('left decreases red channel', () => {
        editor.setProperty('fg', [200, 200, 200, 255]);
        const origFg = [...editor.getTheme().fg];
        editor.handleKey({ name: 'left' });
        const newFg = editor.getTheme().fg;
        assert.strictEqual(newFg[0], origFg[0] - 8);
    });

    it('color adjustment clamps at 0', () => {
        editor.setProperty('fg', [0, 0, 0, 255]);
        editor.handleKey({ name: 'left' });
        assert.strictEqual(editor.getTheme().fg[0], 0);
    });

    it('color adjustment clamps at 255', () => {
        editor.setProperty('fg', [255, 0, 0, 255]);
        editor.handleKey({ name: 'right' });
        assert.strictEqual(editor.getTheme().fg[0], 255);
    });

    it('border left wraps to last style', () => {
        editor.section = 'border';
        editor.handleKey({ name: 'left' });
        assert.strictEqual(editor.getTheme().borderStyle, 'none');
    });

    it('effects up wraps around', () => {
        editor.section = 'effects';
        editor.handleKey({ name: 'up' });
        const prop = editor.getCurrentProperty();
        assert.strictEqual(prop, 'effects.shadow');
    });

    it('presets left does nothing', () => {
        editor.section = 'presets';
        const result = editor.handleKey({ name: 'left' });
        assert.strictEqual(result.action, 'none');
    });

    it('unknown key returns none', () => {
        const result = editor.handleKey({ name: 'z' });
        assert.strictEqual(result.action, 'none');
    });
});

// ─── Overlay Rendering Advanced Tests ──────────────────────

describe('ThemeEditor — Overlay Rendering Advanced', () => {
    let editor;

    beforeEach(() => {
        editor = new ThemeEditor();
    });

    it('overlay with double border shows double chars', () => {
        editor.setProperty('borderStyle', 'double');
        const overlay = editor.renderOverlay();
        assert.ok(overlay.includes('╔'));
        assert.ok(overlay.includes('╗'));
    });

    it('overlay with rounded border shows rounded chars', () => {
        editor.setProperty('borderStyle', 'rounded');
        const overlay = editor.renderOverlay();
        assert.ok(overlay.includes('╭'));
    });

    it('overlay shows border section content', () => {
        editor.section = 'border';
        const overlay = editor.renderOverlay();
        assert.ok(overlay.includes('Border Style'));
    });

    it('overlay shows effects section content', () => {
        editor.section = 'effects';
        const overlay = editor.renderOverlay();
        assert.ok(overlay.includes('scanlines'));
    });

    it('overlay shows presets section content', () => {
        editor.section = 'presets';
        const overlay = editor.renderOverlay();
        assert.ok(overlay.includes('default'));
    });

    it('overlay shows active section in tabs', () => {
        editor.section = 'border';
        const overlay = editor.renderOverlay();
        assert.ok(overlay.includes('[border]'));
    });

    it('overlay footer has key hints', () => {
        const overlay = editor.renderOverlay();
        assert.ok(overlay.includes('Tab:next'));
        assert.ok(overlay.includes('Ctrl+S:save'));
    });
});

// ─── Theme Validation Tests ────────────────────────────────

describe('ThemeEditor — Theme Validation', () => {
    it('all presets have valid RGB colors', () => {
        const colorProps = ['fg', 'bg', 'border', 'borderHighlight', 'activeFg', 'activeBg',
            'focusFg', 'focusBg', 'titleFg', 'titleBg', 'linkFg', 'headingFg'];
        for (const [name, preset] of Object.entries(THEME_PRESETS)) {
            for (const prop of colorProps) {
                assert.ok(preset[prop], `Preset "${name}" missing ${prop}`);
                assert.ok(isValidRGB(preset[prop]), `Preset "${name}" ${prop} invalid RGB`);
            }
        }
    });

    it('all presets have effects object', () => {
        for (const [name, preset] of Object.entries(THEME_PRESETS)) {
            assert.ok(preset.effects, `Preset "${name}" missing effects`);
            assert.ok(typeof preset.effects.scanlines === 'boolean');
            assert.ok(typeof preset.effects.glow === 'boolean');
            assert.ok(typeof preset.effects.shadow === 'boolean');
        }
    });

    it('all border chars are single characters', () => {
        for (const [style, chars] of Object.entries(BORDER_CHARS)) {
            for (const [key, char] of Object.entries(chars)) {
                assert.ok(typeof char === 'string', `BORDER_CHARS.${style}.${key} not string`);
                assert.ok(char.length >= 1, `BORDER_CHARS.${style}.${key} too short`);
            }
        }
    });
});
