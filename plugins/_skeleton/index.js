// plugins/_skeleton/index.js
// Template for new plugins — copy this directory and customize

import { Plugin } from '../../sync/plugin-api.js';

export default class SkeletonPlugin extends Plugin {
    constructor(manifest) {
        super(manifest);
    }

    onLoad(context) {
        super.onLoad(context);
        // Subscribe to events you care about:
        // context.events.on('page-change', (data) => { ... });
        // context.events.on('content-update', (data) => { ... });
    }

    registerRegions(layoutEngine) {
        return super.registerRegions(layoutEngine);
    }

    render(screenManager, region) {
        // Draw into the assigned region using screenManager
    }

    handleInput(keyEvent, focusedRegion) {
        // Handle keyboard/mouse input
        return false;
    }

    onUnload() {
        super.onUnload();
        // Clean up resources
    }
}
