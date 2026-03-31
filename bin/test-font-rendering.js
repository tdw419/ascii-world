import { PixelBuffer } from '../sync/pixel-buffer.js';
import { GlyphAtlas } from '../sync/glyph-atlas.js';
import { writeFileSync, mkdirSync } from 'fs';

async function test() {
    const buf = new PixelBuffer(480, 240);
    const atlas = new GlyphAtlas();
    
    buf.fill(20, 20, 40); // Dark background
    
    // Draw some test text
    atlas.drawText(buf, 20, 20, "GEOMETRY OS", [0, 255, 255]);
    atlas.drawText(buf, 20, 40, "SPATIAL DOCUMENT V1.0", [255, 255, 255]);
    atlas.drawText(buf, 20, 70, "Testing GlyphAtlas integration...", [150, 150, 150]);
    
    // Draw some symbols
    atlas.drawText(buf, 20, 100, "● ○ ◉ ◐ ✗ █ ▓ ▒ ░", [0, 255, 0]);
    
    // Draw a box
    atlas.drawText(buf, 200, 150, "╔══════════════╗", [255, 200, 0]);
    atlas.drawText(buf, 200, 160, "║  AI TRAINING ║", [255, 200, 0]);
    atlas.drawText(buf, 200, 170, "╚══════════════╝", [255, 200, 0]);

    mkdirSync('./.ouroboros/training_data/fonts', { recursive: true });
    const png = await buf.toPNG();
    writeFileSync('./.ouroboros/training_data/fonts/baseline_test.png', png);
    console.log("✅ Baseline font render saved to ./.ouroboros/training_data/fonts/baseline_test.png");
}

test().catch(console.error);
