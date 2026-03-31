// plugins/content-editor/index.js
// AI Content Editor Plugin — inline content editing in the terminal
// Part of CMS Phase 4.2 — Built-in Plugins

import { Plugin } from '../../sync/plugin-api.js';

/**
 * ContentEditorPlugin provides inline content editing in the terminal.
 * Features:
 * - Cursor-based text editing within a content region
 * - AI assist: select text, press Ctrl+A for AI rewrite/suggest
 * - Markdown-like input: # for heading, - for list, > for quote
 * - Edit mode toggle
 *
 * Region: body (when in edit mode)
 */
export default class ContentEditorPlugin extends Plugin {
    constructor(manifest) {
        super(manifest);
        this.editMode = false;
        this.content = '';
        this.cursorPos = 0;
        this.selectedRange = null; // { start, end }
        this.aiSuggestion = null;
        this._buffer = [];
        this._currentContentId = null;
    }

    onLoad(context) {
        super.onLoad(context);

        // Listen for content updates
        context.events.on('content-update', (data) => {
            if (data && data.id === this._currentContentId) {
                this._loadContent(data.id);
            }
        });

        context.events.on('page-change', () => {
            // Reset editor when page changes
            this.editMode = false;
            this.aiSuggestion = null;
            this.selectedRange = null;
        });
    }

    registerRegions(layoutEngine) {
        return super.registerRegions(layoutEngine);
    }

    /**
     * Load content from the content store.
     * @param {string} contentId
     */
    _loadContent(contentId) {
        if (!this.context || !this.context.contentStore) return;
        const item = this.context.contentStore.read(contentId);
        if (item) {
            this.content = item.body || '';
            this._currentContentId = contentId;
            this.cursorPos = Math.min(this.cursorPos, this.content.length);
        }
    }

    /**
     * Set content directly (for testing or programmatic use).
     * @param {string} text
     */
    setContent(text) {
        this.content = text || '';
        this.cursorPos = this.content.length;
        this.selectedRange = null;
    }

    /**
     * Get the current content.
     * @returns {string}
     */
    getContent() {
        return this.content;
    }

    /**
     * Get the cursor position.
     * @returns {number}
     */
    getCursorPos() {
        return this.cursorPos;
    }

    /**
     * Is the editor in edit mode?
     * @returns {boolean}
     */
    isEditMode() {
        return this.editMode;
    }

    /**
     * Toggle edit mode.
     * @returns {boolean} new edit mode state
     */
    toggleEditMode() {
        this.editMode = !this.editMode;
        return this.editMode;
    }

    /**
     * Get the current AI suggestion.
     * @returns {string|null}
     */
    getAiSuggestion() {
        return this.aiSuggestion;
    }

    /**
     * Get the selected range.
     * @returns {Object|null} { start, end }
     */
    getSelectedRange() {
        return this.selectedRange;
    }

    /**
     * Insert text at cursor position.
     * @param {string} text
     */
    insertText(text) {
        if (!this.editMode) return;

        // Delete selection if any
        if (this.selectedRange) {
            const { start, end } = this.selectedRange;
            this.content = this.content.slice(0, start) + this.content.slice(end);
            this.cursorPos = start;
            this.selectedRange = null;
        }

        // Handle markdown-like shortcuts
        let insertText = text;

        this.content = this.content.slice(0, this.cursorPos) + insertText + this.content.slice(this.cursorPos);
        this.cursorPos += insertText.length;
    }

    /**
     * Delete character before cursor (backspace).
     */
    backspace() {
        if (!this.editMode) return;

        if (this.selectedRange) {
            const { start, end } = this.selectedRange;
            this.content = this.content.slice(0, start) + this.content.slice(end);
            this.cursorPos = start;
            this.selectedRange = null;
            return;
        }

        if (this.cursorPos > 0) {
            this.content = this.content.slice(0, this.cursorPos - 1) + this.content.slice(this.cursorPos);
            this.cursorPos--;
        }
    }

    /**
     * Delete character at cursor (delete).
     */
    deleteForward() {
        if (!this.editMode) return;

        if (this.selectedRange) {
            const { start, end } = this.selectedRange;
            this.content = this.content.slice(0, start) + this.content.slice(end);
            this.cursorPos = start;
            this.selectedRange = null;
            return;
        }

        if (this.cursorPos < this.content.length) {
            this.content = this.content.slice(0, this.cursorPos) + this.content.slice(this.cursorPos + 1);
        }
    }

    /**
     * Move cursor left.
     */
    moveLeft() {
        if (this.cursorPos > 0) {
            this.cursorPos--;
        }
    }

    /**
     * Move cursor right.
     */
    moveRight() {
        if (this.cursorPos < this.content.length) {
            this.cursorPos++;
        }
    }

    /**
     * Move cursor to start.
     */
    moveHome() {
        this.cursorPos = 0;
    }

    /**
     * Move cursor to end.
     */
    moveEnd() {
        this.cursorPos = this.content.length;
    }

    /**
     * Select all text.
     */
    selectAll() {
        this.selectedRange = { start: 0, end: this.content.length };
    }

    /**
     * Request AI assistance for selected text.
     * Generates a suggestion based on the selected content.
     */
    requestAiAssist() {
        let targetText = this.content;
        if (this.selectedRange) {
            targetText = this.content.slice(this.selectedRange.start, this.selectedRange.end);
        }

        // Simple AI assist: generate suggestions based on content patterns
        if (!targetText || targetText.trim().length === 0) {
            this.aiSuggestion = null;
            return;
        }

        // Pattern-based suggestions
        if (targetText.startsWith('#')) {
            this.aiSuggestion = 'Consider adding subheadings (##) for better structure.';
        } else if (targetText.startsWith('- ')) {
            this.aiSuggestion = 'Use numbered lists (1.) for sequential items.';
        } else if (targetText.startsWith('> ')) {
            this.aiSuggestion = 'Quote detected. Consider adding attribution.';
        } else if (targetText.length < 20) {
            this.aiSuggestion = 'Content seems short. Consider expanding with more detail.';
        } else {
            this.aiSuggestion = 'Content looks good. Consider adding a heading or list for clarity.';
        }
    }

    /**
     * Accept the AI suggestion (replace selected text or append).
     */
    acceptAiSuggestion() {
        if (!this.aiSuggestion) return;

        if (this.selectedRange) {
            // Replace selection with suggestion
            const { start, end } = this.selectedRange;
            this.content = this.content.slice(0, start) + this.aiSuggestion + this.content.slice(end);
            this.cursorPos = start + this.aiSuggestion.length;
            this.selectedRange = null;
        } else {
            // Append suggestion as a new line
            this.content += '\n' + this.aiSuggestion;
            this.cursorPos = this.content.length;
        }

        this.aiSuggestion = null;
    }

    /**
     * Dismiss the AI suggestion.
     */
    dismissAiSuggestion() {
        this.aiSuggestion = null;
    }

    /**
     * Save content back to the content store.
     * @returns {boolean}
     */
    save() {
        if (!this.context || !this.context.contentStore || !this._currentContentId) {
            return false;
        }

        const updated = this.context.contentStore.update(this._currentContentId, {
            body: this.content,
        });

        if (updated) {
            this.context.events.emit('content-update', {
                id: this._currentContentId,
                body: this.content,
            });
        }

        return !!updated;
    }

    /**
     * Render the content editor.
     * @param {Object} screenManager
     * @param {string} region
     */
    render(screenManager, region) {
        if (region !== 'body') return;

        this._buffer = [];

        // Status bar
        const modeLabel = this.editMode ? 'EDIT' : 'VIEW';
        const statusLine = `[${modeLabel}] Cursor:${this.cursorPos}/${this.content.length}`;
        this._buffer.push(statusLine);

        // Content lines
        const lines = this.content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            // Apply markdown-like formatting
            if (line.startsWith('# ')) {
                line = '\u2501'.repeat(line.length + 2) + '\n' + line + '\n' + '\u2501'.repeat(line.length + 2);
            } else if (line.startsWith('## ')) {
                line = '\u2500'.repeat(line.length) + '\n' + line;
            } else if (line.startsWith('> ')) {
                line = '│ ' + line.slice(2);
            }
            this._buffer.push(line);
        }

        // Cursor indicator in edit mode
        if (this.editMode) {
            const cursorLine = ' '.repeat(this.cursorPos) + '▊';
            this._buffer.push(cursorLine);
        }

        // AI suggestion
        if (this.aiSuggestion) {
            this._buffer.push('── AI Suggest ──');
            this._buffer.push(this.aiSuggestion);
            this._buffer.push('[Enter] Accept  [Esc] Dismiss');
        }

        // Selection indicator
        if (this.selectedRange) {
            this._buffer.push(`[Selected: ${this.selectedRange.start}-${this.selectedRange.end}]`);
        }

        // Write to screen
        if (screenManager && typeof screenManager.writeAt === 'function') {
            for (let y = 0; y < this._buffer.length; y++) {
                screenManager.writeAt(0, y, this._buffer[y]);
            }
        }
    }

    /**
     * Get the rendered buffer.
     * @returns {string[]}
     */
    getBuffer() {
        return [...this._buffer];
    }

    /**
     * Handle keyboard input.
     * @param {Object} keyEvent
     * @param {string} focusedRegion
     * @returns {boolean}
     */
    handleInput(keyEvent, focusedRegion) {
        if (focusedRegion !== 'body') return false;

        const key = keyEvent.key || keyEvent.name || '';
        const ctrl = keyEvent.ctrl || keyEvent.meta || false;

        // AI suggestion handling takes priority
        if (this.aiSuggestion) {
            if (key === 'enter' || key === 'Return') {
                this.acceptAiSuggestion();
                return true;
            }
            if (key === 'escape' || key === 'Escape') {
                this.dismissAiSuggestion();
                return true;
            }
            return false;
        }

        // Toggle edit mode with 'e' key when not in edit mode
        if (!this.editMode) {
            if (key === 'e') {
                this.toggleEditMode();
                return true;
            }
            return false;
        }

        // Edit mode key handling
        if (ctrl && (key === 'a' || key === 'A')) {
            // Ctrl+A: AI assist
            this.requestAiAssist();
            return true;
        }

        if (key === 'escape' || key === 'Escape') {
            this.toggleEditMode();
            return true;
        }

        if (key === 'left' || key === 'ArrowLeft') {
            this.moveLeft();
            return true;
        }
        if (key === 'right' || key === 'ArrowRight') {
            this.moveRight();
            return true;
        }
        if (key === 'home' || key === 'Home') {
            this.moveHome();
            return true;
        }
        if (key === 'end' || key === 'End') {
            this.moveEnd();
            return true;
        }
        if (key === 'backspace' || key === 'Backspace') {
            this.backspace();
            return true;
        }
        if (key === 'delete' || key === 'Delete') {
            this.deleteForward();
            return true;
        }
        if (key === 'enter' || key === 'Return') {
            this.insertText('\n');
            return true;
        }
        if (key === 'tab' || key === 'Tab') {
            this.insertText('    ');
            return true;
        }

        // Ctrl+S to save
        if (ctrl && (key === 's' || key === 'S')) {
            this.save();
            return true;
        }

        // Regular character input
        if (key.length === 1 && !ctrl) {
            this.insertText(key);
            return true;
        }

        return false;
    }

    onUnload() {
        this.content = '';
        this._buffer = [];
        this.aiSuggestion = null;
        this.selectedRange = null;
        super.onUnload();
    }
}
