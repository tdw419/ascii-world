// tests/theme-editor.test.js
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
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
