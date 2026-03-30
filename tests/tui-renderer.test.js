/**
 * Tests for sync/renderers/tui.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseASCIIToComponents } from '../sync/renderers/tui.js';

describe('tui-renderer', () => {
    describe('parseASCIIToComponents', () => {
        it('detects buttons with [X] Label format', () => {
            const ascii = '  [A] Start    [S] Stop  ';
            const components = parseASCIIToComponents(ascii);
            
            assert.strictEqual(components.buttons.length, 2);
            assert.strictEqual(components.buttons[0].key, 'A');
            assert.strictEqual(components.buttons[0].label, 'Start');
            assert.strictEqual(components.buttons[0].action, 'start');
            
            assert.strictEqual(components.buttons[1].key, 'S');
            assert.strictEqual(components.buttons[1].label, 'Stop');
            assert.strictEqual(components.buttons[1].action, 'stop');
        });

        it('detects progress bars with [████░░░] XX% format', () => {
            const ascii = 'Loading: [████░░░░] 50%';
            const components = parseASCIIToComponents(ascii);
            
            assert.strictEqual(components.progressBars.length, 1);
            assert.strictEqual(components.progressBars[0].value, 50);
            assert.strictEqual(components.progressBars[0].total, 8);
            assert.strictEqual(components.progressBars[0].filled, 4);
        });

        it('detects status indicators', () => {
            const ascii = '● Active  ○ Idle  ◉ Error';
            const components = parseASCIIToComponents(ascii);
            
            assert.strictEqual(components.labels.length, 3);
            assert.strictEqual(components.labels[0].status, 'active');
            assert.strictEqual(components.labels[1].status, 'idle');
            assert.strictEqual(components.labels[2].status, 'error');
        });

        it('detects boxes and title', () => {
            const ascii = [
                '┌──────────────┐',
                '│  Main Title  │',
                '├──────────────┤',
                '│ Content here │',
                '└──────────────┘'
            ].join('\n');
            
            const components = parseASCIIToComponents(ascii);
            
            assert.strictEqual(components.title, 'Main Title');
            assert.strictEqual(components.boxes.length, 1);
            assert.strictEqual(components.boxes[0].width, 16);
            assert.strictEqual(components.boxes[0].height, 5);
        });

        it('detects input fields', () => {
            const ascii = 'Search: > ____________________';
            const components = parseASCIIToComponents(ascii);
            
            assert.strictEqual(components.inputs.length, 1);
            assert.strictEqual(components.inputs[0].width, 20);
        });
    });
});
