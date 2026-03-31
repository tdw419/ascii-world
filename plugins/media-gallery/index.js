// plugins/media-gallery/index.js
// Media Gallery Plugin — renders ASCII art images in a grid
// Part of CMS Phase 4.2 — Built-in Plugins

import { Plugin } from '../../sync/plugin-api.js';

/**
 * MediaGalleryPlugin renders ASCII art images in a scrollable grid.
 * Features:
 * - Renders ASCII art images in a grid layout
 * - Scrollable gallery view
 * - Image metadata: title, alt text, source
 * - Import from file or paste ASCII art directly
 *
 * Region: body or sidebar
 */
export default class MediaGalleryPlugin extends Plugin {
    constructor(manifest) {
        super(manifest);
        this.images = [];
        this.scrollOffset = 0;
        this.selectedIndex = 0;
        this.gridColumns = 3;
        this.maxItemHeight = 8; // max lines per image preview
        this._buffer = [];
        this._nextId = 1;
    }

    onLoad(context) {
        super.onLoad(context);
        // Load any saved gallery from content store media items
        this._loadGallery();
    }

    registerRegions(layoutEngine) {
        return super.registerRegions(layoutEngine);
    }

    /**
     * Load gallery items from content store.
     */
    _loadGallery() {
        if (!this.context || !this.context.contentStore) return;
        const mediaItems = this.context.contentStore.list({ type: 'media' });
        this.images = mediaItems.map(item => ({
            id: item.id,
            title: item.title,
            alt: item.metadata.alt || '',
            source: item.metadata.source || '',
            art: item.body || '',
        }));
    }

    /**
     * Add an image to the gallery.
     * @param {Object} image
     * @param {string} image.title - Image title
     * @param {string} [image.alt] - Alt text
     * @param {string} [image.source] - Source URL or file path
     * @param {string} image.art - ASCII art content
     * @returns {Object} the added image with id
     */
    addImage({ title, alt = '', source = '', art }) {
        if (!art || typeof art !== 'string') {
            throw new Error('ASCII art content is required');
        }

        const image = {
            id: `img_${this._nextId++}`,
            title: title || 'Untitled',
            alt,
            source,
            art,
        };

        this.images.push(image);

        // Persist to content store
        if (this.context && this.context.contentStore) {
            const item = this.context.contentStore.create({
                type: 'media',
                title: image.title,
                body: image.art,
                metadata: { alt: image.alt, source: image.source, galleryId: image.id },
            });
            image.contentId = item.id;
        }

        return image;
    }

    /**
     * Remove an image by index.
     * @param {number} index
     * @returns {boolean}
     */
    removeImage(index) {
        if (index < 0 || index >= this.images.length) return false;

        const image = this.images[index];

        // Remove from content store
        if (this.context && this.context.contentStore && image.contentId) {
            this.context.contentStore.delete(image.contentId);
        }

        this.images.splice(index, 1);

        // Adjust selection
        if (this.selectedIndex >= this.images.length) {
            this.selectedIndex = Math.max(0, this.images.length - 1);
        }

        return true;
    }

    /**
     * Get all images.
     * @returns {Array}
     */
    getImages() {
        return [...this.images];
    }

    /**
     * Get image at index.
     * @param {number} index
     * @returns {Object|null}
     */
    getImage(index) {
        return this.images[index] || null;
    }

    /**
     * Get the currently selected index.
     * @returns {number}
     */
    getSelectedIndex() {
        return this.selectedIndex;
    }

    /**
     * Get the scroll offset.
     * @returns {number}
     */
    getScrollOffset() {
        return this.scrollOffset;
    }

    /**
     * Get grid columns count.
     * @returns {number}
     */
    getGridColumns() {
        return this.gridColumns;
    }

    /**
     * Set grid columns.
     * @param {number} cols
     */
    setGridColumns(cols) {
        if (cols >= 1 && cols <= 6) {
            this.gridColumns = cols;
        }
    }

    /**
     * Render the gallery view.
     * @param {Object} screenManager
     * @param {string} region
     */
    render(screenManager, region) {
        if (region !== 'body' && region !== 'sidebar') return;

        this._buffer = [];

        if (this.images.length === 0) {
            this._buffer.push('  [ Empty Gallery ]');
            this._buffer.push('  Press i to import ASCII art');
        } else {
            // Header
            this._buffer.push(`Gallery: ${this.images.length} images  [Scroll: ${this.scrollOffset}]`);
            this._buffer.push('');

            // Render grid
            const cols = region === 'sidebar' ? 1 : this.gridColumns;
            const visibleStart = this.scrollOffset * cols;
            const maxVisible = Math.min(visibleStart + (cols * 4), this.images.length); // 4 rows

            for (let i = visibleStart; i < maxVisible; i++) {
                const image = this.images[i];
                const col = (i - visibleStart) % cols;
                const isSelected = i === this.selectedIndex;

                // Preview: first few lines of the art
                const artLines = image.art.split('\n').slice(0, this.maxItemHeight);
                const titleLine = (isSelected ? '> ' : '  ') + image.title;

                if (col === 0) {
                    this._buffer.push(titleLine);
                } else {
                    // Append to same line for multi-column (simplified)
                    this._buffer.push(titleLine);
                }

                for (const line of artLines) {
                    const prefix = isSelected ? '│' : ' ';
                    this._buffer.push(`${prefix} ${line}`);
                }

                this._buffer.push('');
            }
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
        if (focusedRegion !== 'body' && focusedRegion !== 'sidebar') return false;

        const key = keyEvent.key || keyEvent.name || '';

        if (key === 'up' || key === 'ArrowUp') {
            if (this.selectedIndex >= this.gridColumns) {
                this.selectedIndex -= this.gridColumns;
            } else {
                this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            }
            this._adjustScroll();
            return true;
        }
        if (key === 'down' || key === 'ArrowDown') {
            const maxIdx = this.images.length - 1;
            if (this.selectedIndex + this.gridColumns <= maxIdx) {
                this.selectedIndex += this.gridColumns;
            } else {
                this.selectedIndex = Math.min(maxIdx, this.selectedIndex + 1);
            }
            this._adjustScroll();
            return true;
        }
        if (key === 'left' || key === 'ArrowLeft') {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this._adjustScroll();
            return true;
        }
        if (key === 'right' || key === 'ArrowRight') {
            this.selectedIndex = Math.min(this.images.length - 1, this.selectedIndex + 1);
            this._adjustScroll();
            return true;
        }
        if (key === 'delete' || key === 'Delete' || key === 'd') {
            return this.removeImage(this.selectedIndex);
        }

        return false;
    }

    /**
     * Adjust scroll offset to keep selected item visible.
     */
    _adjustScroll() {
        const cols = this.gridColumns;
        const selectedRow = Math.floor(this.selectedIndex / cols);
        const maxVisibleRows = 4;

        if (selectedRow < this.scrollOffset) {
            this.scrollOffset = selectedRow;
        } else if (selectedRow >= this.scrollOffset + maxVisibleRows) {
            this.scrollOffset = selectedRow - maxVisibleRows + 1;
        }
    }

    onUnload() {
        this.images = [];
        this._buffer = [];
        super.onUnload();
    }
}
