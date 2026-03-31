/**
 * Tests for sync/layout-engine.js
 * Covers: preset loading, region computation, resize, all 5 presets
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LayoutEngine, LAYOUT_PRESETS, evalFormula } from '../sync/layout-engine.js';

describe('LayoutEngine - formula evaluation', () => {
    it('evaluates simple integer formulas', () => {
        assert.strictEqual(evalFormula('0', 80, 24), 0);
        assert.strictEqual(evalFormula('3', 80, 24), 3);
        assert.strictEqual(evalFormula('80', 80, 24), 80);
    });

    it('evaluates formulas with W and H', () => {
        assert.strictEqual(evalFormula('W', 80, 24), 80);
        assert.strictEqual(evalFormula('H', 80, 24), 24);
    });

    it('evaluates arithmetic formulas', () => {
        assert.strictEqual(evalFormula('H-3', 80, 24), 21);
        assert.strictEqual(evalFormula('H-6', 80, 24), 18);
        assert.strictEqual(evalFormula('floor(W/2)', 80, 24), 40);
        assert.strictEqual(evalFormula('W-floor(W/2)', 80, 24), 40);
        assert.strictEqual(evalFormula('floor(W*0.725)', 80, 24), 58);
        assert.strictEqual(evalFormula('floor(H/2)', 80, 24), 12);
    });

    it('evaluates floor(H/2) and derived formulas for hero preset', () => {
        const heroH = evalFormula('floor(H/2)', 80, 24);
        assert.strictEqual(heroH, 12);
        const bodyH = evalFormula('H-6-floor(H/2)', 80, 24);
        assert.strictEqual(bodyH, 6);
    });
});

describe('LayoutEngine - module exports', () => {
    it('exports LayoutEngine class', () => {
        assert.ok(LayoutEngine);
        assert.strictEqual(typeof LayoutEngine, 'function');
    });

    it('exports LAYOUT_PRESETS as a Map', () => {
        assert.ok(LAYOUT_PRESETS instanceof Map);
    });

    it('LAYOUT_PRESETS contains all 5 presets', () => {
        const expected = ['single-column', 'two-column', 'sidebar-left', 'magazine', 'hero'];
        for (const name of expected) {
            assert.ok(LAYOUT_PRESETS.has(name), `Missing preset: ${name}`);
        }
    });
});

describe('LayoutEngine - constructor', () => {
    it('uses default dimensions 80x24', () => {
        const engine = new LayoutEngine();
        assert.strictEqual(engine.width, 80);
        assert.strictEqual(engine.height, 24);
    });

    it('accepts custom dimensions', () => {
        const engine = new LayoutEngine({ width: 120, height: 40 });
        assert.strictEqual(engine.width, 120);
        assert.strictEqual(engine.height, 40);
    });

    it('starts with no preset loaded', () => {
        const engine = new LayoutEngine();
        assert.strictEqual(engine.currentPreset, null);
    });
});

describe('LayoutEngine - single-column preset', () => {
    const engine = new LayoutEngine();
    engine.loadPreset('single-column');

    it('loads successfully', () => {
        assert.strictEqual(engine.currentPreset, 'single-column');
    });

    it('header region is correct', () => {
        const header = engine.getRegion('header');
        assert.deepEqual({ name: 'header', x: 0, y: 0, w: 80, h: 3 }, header);
    });

    it('body region is correct', () => {
        const body = engine.getRegion('body');
        assert.deepEqual({ name: 'body', x: 0, y: 3, w: 80, h: 18 }, body);
    });

    it('footer region is correct', () => {
        const footer = engine.getRegion('footer');
        assert.deepEqual({ name: 'footer', x: 0, y: 21, w: 80, h: 3 }, footer);
    });

    it('regions cover the full grid without gaps', () => {
        const header = engine.getRegion('header');
        const body = engine.getRegion('body');
        const footer = engine.getRegion('footer');
        // header bottom edge = body top edge
        assert.strictEqual(header.y + header.h, body.y);
        // body bottom edge = footer top edge
        assert.strictEqual(body.y + body.h, footer.y);
        // footer bottom edge = total height
        assert.strictEqual(footer.y + footer.h, 24);
    });

    it('getAllRegions returns all 3 regions', () => {
        const all = engine.getAllRegions();
        assert.strictEqual(all.size, 3);
        assert.ok(all.has('header'));
        assert.ok(all.has('body'));
        assert.ok(all.has('footer'));
    });
});

describe('LayoutEngine - two-column preset', () => {
    const engine = new LayoutEngine();
    engine.loadPreset('two-column');

    it('loads successfully', () => {
        assert.strictEqual(engine.currentPreset, 'two-column');
    });

    it('header is full width', () => {
        const header = engine.getRegion('header');
        assert.strictEqual(header.x, 0);
        assert.strictEqual(header.y, 0);
        assert.strictEqual(header.w, 80);
        assert.strictEqual(header.h, 3);
    });

    it('body is left column', () => {
        const body = engine.getRegion('body');
        assert.strictEqual(body.x, 0);
        assert.strictEqual(body.y, 3);
        assert.strictEqual(body.w, 58); // floor(80*0.725) = 58
        assert.strictEqual(body.h, 18);
    });

    it('sidebar is right column', () => {
        const sidebar = engine.getRegion('sidebar');
        assert.strictEqual(sidebar.x, 58);
        assert.strictEqual(sidebar.y, 3);
        assert.strictEqual(sidebar.w, 22); // 80 - 58 = 22
        assert.strictEqual(sidebar.h, 18);
    });

    it('footer is full width', () => {
        const footer = engine.getRegion('footer');
        assert.strictEqual(footer.x, 0);
        assert.strictEqual(footer.y, 21);
        assert.strictEqual(footer.w, 80);
        assert.strictEqual(footer.h, 3);
    });

    it('body + sidebar span full width', () => {
        const body = engine.getRegion('body');
        const sidebar = engine.getRegion('sidebar');
        assert.strictEqual(body.x + body.w, sidebar.x);
        assert.strictEqual(body.x + body.w + sidebar.w, 80);
    });

    it('getAllRegions returns all 4 regions', () => {
        assert.strictEqual(engine.getAllRegions().size, 4);
    });
});

describe('LayoutEngine - sidebar-left preset', () => {
    const engine = new LayoutEngine();
    engine.loadPreset('sidebar-left');

    it('loads successfully', () => {
        assert.strictEqual(engine.currentPreset, 'sidebar-left');
    });

    it('sidebar is left column', () => {
        const sidebar = engine.getRegion('sidebar');
        assert.strictEqual(sidebar.x, 0);
        assert.strictEqual(sidebar.y, 3);
        assert.strictEqual(sidebar.w, 22); // floor(80*0.275) = 22
        assert.strictEqual(sidebar.h, 18);
    });

    it('body is right of sidebar', () => {
        const body = engine.getRegion('body');
        assert.strictEqual(body.x, 22);
        assert.strictEqual(body.y, 3);
        assert.strictEqual(body.w, 58); // 80 - 22 = 58
        assert.strictEqual(body.h, 18);
    });

    it('sidebar + body span full width', () => {
        const sidebar = engine.getRegion('sidebar');
        const body = engine.getRegion('body');
        assert.strictEqual(sidebar.x + sidebar.w, body.x);
        assert.strictEqual(sidebar.w + body.w, 80);
    });
});

describe('LayoutEngine - magazine preset', () => {
    const engine = new LayoutEngine();
    engine.loadPreset('magazine');

    it('loads successfully', () => {
        assert.strictEqual(engine.currentPreset, 'magazine');
    });

    it('left column is half width', () => {
        const left = engine.getRegion('left');
        assert.strictEqual(left.x, 0);
        assert.strictEqual(left.y, 3);
        assert.strictEqual(left.w, 40);
        assert.strictEqual(left.h, 18);
    });

    it('right column is half width', () => {
        const right = engine.getRegion('right');
        assert.strictEqual(right.x, 40);
        assert.strictEqual(right.y, 3);
        assert.strictEqual(right.w, 40);
        assert.strictEqual(right.h, 18);
    });

    it('left + right span full width', () => {
        const left = engine.getRegion('left');
        const right = engine.getRegion('right');
        assert.strictEqual(left.w + right.w, 80);
        assert.strictEqual(left.x + left.w, right.x);
    });
});

describe('LayoutEngine - hero preset', () => {
    const engine = new LayoutEngine();
    engine.loadPreset('hero');

    it('loads successfully', () => {
        assert.strictEqual(engine.currentPreset, 'hero');
    });

    it('hero region occupies top half', () => {
        const hero = engine.getRegion('hero');
        assert.strictEqual(hero.x, 0);
        assert.strictEqual(hero.y, 0);
        assert.strictEqual(hero.w, 80);
        assert.strictEqual(hero.h, 12); // floor(24/2) = 12
    });

    it('body region is below hero', () => {
        const hero = engine.getRegion('hero');
        const body = engine.getRegion('body');
        assert.strictEqual(body.x, 0);
        assert.strictEqual(body.y, 12);
        assert.strictEqual(body.w, 80);
        assert.strictEqual(body.h, 9); // 24 - 12 - 3 = 9
        assert.strictEqual(hero.y + hero.h, body.y);
    });

    it('footer is at bottom', () => {
        const footer = engine.getRegion('footer');
        assert.strictEqual(footer.x, 0);
        assert.strictEqual(footer.y, 21);
        assert.strictEqual(footer.w, 80);
        assert.strictEqual(footer.h, 3);
    });

    it('all regions tile vertically', () => {
        const hero = engine.getRegion('hero');
        const body = engine.getRegion('body');
        const footer = engine.getRegion('footer');
        assert.strictEqual(hero.y + hero.h, body.y);
        assert.strictEqual(body.y + body.h, footer.y);
        assert.strictEqual(footer.y + footer.h, 24);
    });
});

describe('LayoutEngine - resize', () => {
    it('recomputes regions on resize', () => {
        const engine = new LayoutEngine({ width: 80, height: 24 });
        engine.loadPreset('single-column');

        // Before resize
        let header = engine.getRegion('header');
        assert.strictEqual(header.w, 80);
        assert.strictEqual(header.h, 3);

        engine.resize(120, 40);

        header = engine.getRegion('header');
        assert.strictEqual(header.w, 120);
        assert.strictEqual(header.h, 3);

        const body = engine.getRegion('body');
        assert.strictEqual(body.w, 120);
        assert.strictEqual(body.h, 34); // 40 - 6 = 34
        assert.strictEqual(body.y, 3);

        const footer = engine.getRegion('footer');
        assert.strictEqual(footer.y, 37); // 40 - 3 = 37
        assert.strictEqual(footer.h, 3);
    });

    it('two-column resize adjusts proportions', () => {
        const engine = new LayoutEngine({ width: 80, height: 24 });
        engine.loadPreset('two-column');

        engine.resize(120, 40);

        const body = engine.getRegion('body');
        const sidebar = engine.getRegion('sidebar');
        assert.strictEqual(body.w, 87); // floor(120*0.725) = 87
        assert.strictEqual(sidebar.x, 87);
        assert.strictEqual(sidebar.w, 33); // 120 - 87 = 33
        assert.strictEqual(body.w + sidebar.w, 120);
    });

    it('emits resized event', (_, done) => {
        const engine = new LayoutEngine({ width: 80, height: 24 });
        engine.loadPreset('single-column');

        engine.on('resized', (evt) => {
            assert.strictEqual(evt.width, 100);
            assert.strictEqual(evt.height, 30);
            assert.strictEqual(evt.oldWidth, 80);
            assert.strictEqual(evt.oldHeight, 24);
            done();
        });

        engine.resize(100, 30);
    });
});

describe('LayoutEngine - events', () => {
    it('emits preset-loaded event', (_, done) => {
        const engine = new LayoutEngine();

        engine.on('preset-loaded', (evt) => {
            assert.strictEqual(evt.name, 'magazine');
            assert.ok(evt.regions instanceof Map);
            assert.strictEqual(evt.regions.size, 4);
            done();
        });

        engine.loadPreset('magazine');
    });
});

describe('LayoutEngine - edge cases', () => {
    it('loadPreset returns false for unknown preset', () => {
        const engine = new LayoutEngine();
        const result = engine.loadPreset('nonexistent');
        assert.strictEqual(result, false);
        assert.strictEqual(engine.currentPreset, null);
    });

    it('getRegion returns undefined for unknown region', () => {
        const engine = new LayoutEngine();
        engine.loadPreset('single-column');
        assert.strictEqual(engine.getRegion('nonexistent'), undefined);
    });

    it('isInside works correctly', () => {
        const engine = new LayoutEngine();
        engine.loadPreset('single-column');

        // Inside header
        assert.strictEqual(engine.isInside('header', 0, 0), true);
        assert.strictEqual(engine.isInside('header', 79, 2), true);
        assert.strictEqual(engine.isInside('header', 0, 3), false);

        // Inside body
        assert.strictEqual(engine.isInside('body', 0, 3), true);
        assert.strictEqual(engine.isInside('body', 79, 20), true);
        assert.strictEqual(engine.isInside('body', 0, 2), false);
    });

    it('regionAt finds the correct region', () => {
        const engine = new LayoutEngine();
        engine.loadPreset('two-column');

        assert.strictEqual(engine.regionAt(0, 0), 'header');
        assert.strictEqual(engine.regionAt(0, 3), 'body');
        assert.strictEqual(engine.regionAt(60, 3), 'sidebar');
        assert.strictEqual(engine.regionAt(0, 21), 'footer');
    });

    it('isInside returns false for unknown region', () => {
        const engine = new LayoutEngine();
        engine.loadPreset('single-column');
        assert.strictEqual(engine.isInside('bogus', 0, 0), false);
    });

    it('regionAt returns null when no region contains the cell', () => {
        const engine = new LayoutEngine();
        // No preset loaded, no regions
        assert.strictEqual(engine.regionAt(0, 0), null);
    });
});
