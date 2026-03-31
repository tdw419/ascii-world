#!/usr/bin/env node
/**
 * Archive Painter - Maps training data text into the Infinite Map substrate
 *
 * The Archive is the "memory" continent where the AI's training data lives.
 * Each paragraph of text is rendered into pixels at spatial coordinates
 * determined by semantic clustering.
 *
 * Part of Phase 42: The Sovereign Array / Glass Box LLM
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';

const PROJECT_ROOT = '/home/jericho/zion/projects/ascii_world/ascii_world';
const ARCHIVE_DIR = join(PROJECT_ROOT, '.ouroboros', 'archive');
const MANIFEST_PATH = join(ARCHIVE_DIR, 'archive_manifest.json');

mkdirSync(ARCHIVE_DIR, { recursive: true });

// The Archive starts at a different continent (offset from Cortex)
const ARCHIVE_OFFSET_X = 5000;  // Cortex is at 0-3200, Archive at 5000+
const ARCHIVE_OFFSET_Y = 0;

/**
 * Simple text embedder - converts text to a semantic fingerprint
 * In production, this would use a real embedding model (sentence-transformers, etc.)
 */
function embedText(text) {
    // Simple hash-based embedding for demo
    // Creates a 64-dimension "embedding" from text characteristics
    const embedding = new Float32Array(64);

    // Feature extraction
    const words = text.toLowerCase().split(/\s+/);
    const chars = text.split('');

    // Dimension 0-7: character frequency buckets
    const charBuckets = new Array(8).fill(0);
    chars.forEach(c => {
        const code = c.charCodeAt(0);
        charBuckets[code % 8]++;
    });
    for (let i = 0; i < 8; i++) {
        embedding[i] = charBuckets[i] / Math.max(chars.length, 1);
    }

    // Dimension 8-15: word length distribution
    const wordLens = words.map(w => w.length);
    for (let i = 0; i < 8; i++) {
        const count = wordLens.filter(l => l >= i * 2 && l < (i + 1) * 2).length;
        embedding[8 + i] = count / Math.max(words.length, 1);
    }

    // Dimension 16-31: hash-based semantic buckets
    for (let i = 0; i < 16; i++) {
        const hash = createHash('md5')
            .update(text + i.toString())
            .digest();
        embedding[16 + i] = (hash[0] / 128) - 1; // -1 to 1 range
    }

    // Dimension 32-63: n-gram fingerprints
    const bigrams = {};
    for (let i = 0; i < chars.length - 1; i++) {
        const bg = chars[i] + chars[i + 1];
        bigrams[bg] = (bigrams[bg] || 0) + 1;
    }
    const topBigrams = Object.entries(bigrams)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 32);
    topBigrams.forEach(([bg, count], i) => {
        embedding[32 + i] = count / Math.max(chars.length, 1);
    });

    return embedding;
}

/**
 * Reduce embedding to 2D coordinates using simple projection
 * In production, this would use UMAP or t-SNE on all embeddings together
 */
function projectTo2D(embedding, index, total) {
    // Simple approach: use first two PCA-like dimensions + spiral placement
    const x = embedding[0] * 1000 + embedding[16] * 500 + (index % 100) * 50;
    const y = embedding[1] * 1000 + embedding[17] * 500 + Math.floor(index / 100) * 50;

    return {
        x: Math.floor(ARCHIVE_OFFSET_X + Math.abs(x) % 3000),
        y: Math.floor(ARCHIVE_OFFSET_Y + Math.abs(y) % 2000)
    };
}

/**
 * Render text into pixels at given coordinates
 * Each character becomes a colored pixel based on its ASCII value
 */
function renderTextToPixels(text, startX, startY, pixelBuffer) {
    const chars = text.split('');
    let x = startX;
    let y = startY;
    const maxWidth = 80; // Characters per line before wrap

    const positions = [];

    chars.forEach((char, i) => {
        const code = char.charCodeAt(0);

        // Color mapping: make text visible and colorful
        // Use ASCII value to determine color
        const r = Math.min(255, 100 + (code % 155));
        const g = Math.min(255, 80 + ((code * 2) % 175));
        const b = Math.min(255, 120 + ((code * 3) % 135));

        // Record position for manifest
        positions.push({ x, y, char, code });

        // Set pixel in buffer (we'll use this to write to InfiniteMap later)
        if (pixelBuffer.setPixel) {
            pixelBuffer.setPixel(x, y, r, g, b, 255);
        }

        // Advance position
        x++;
        if (x >= startX + maxWidth || char === '\n') {
            x = startX;
            y++;
        }
    });

    return positions;
}

/**
 * Sample training data - in production this would load from TinyStories or similar
 */
const SAMPLE_TRAINING_DATA = [
    {
        category: "physics",
        text: "Gravity is the force that pulls objects toward each other. " +
              "The more massive an object, the stronger its gravitational pull. " +
              "Earth's gravity is what keeps us on the ground and keeps the moon in orbit."
    },
    {
        category: "physics",
        text: "Energy cannot be created or destroyed, only transformed from one form to another. " +
              "This is the law of conservation of energy. A ball at the top of a hill has " +
              "potential energy that converts to kinetic energy as it rolls down."
    },
    {
        category: "math",
        text: "Prime numbers are numbers greater than 1 that can only be divided by 1 and themselves. " +
              "The first prime numbers are 2, 3, 5, 7, 11, 13, 17, 19, 23, and 29. " +
              "Two is the only even prime number."
    },
    {
        category: "math",
        text: "A triangle is a shape with three sides and three angles. " +
              "The sum of all angles in a triangle is always 180 degrees. " +
              "An equilateral triangle has all sides equal and all angles equal to 60 degrees."
    },
    {
        category: "biology",
        text: "Cells are the basic building blocks of all living things. " +
              "They contain DNA which carries genetic information. " +
              "Plant cells have a cell wall and chloroplasts that animal cells do not have."
    },
    {
        category: "biology",
        text: "Photosynthesis is how plants make their own food using sunlight. " +
              "They take in carbon dioxide from the air and water from the soil. " +
              "Using energy from the sun, they convert these into glucose and oxygen."
    },
    {
        category: "history",
        text: "The ancient Egyptians built the pyramids as tombs for their pharaohs. " +
              "The Great Pyramid of Giza is one of the seven wonders of the ancient world. " +
              "It was built around 2560 BCE and took about 20 years to complete."
    },
    {
        category: "language",
        text: "Language is a system of communication using sounds or symbols. " +
              "Humans are unique in our ability to use complex language. " +
              "There are approximately 7,000 languages spoken in the world today."
    },
    {
        category: "programming",
        text: "A variable is a container that holds a value in a computer program. " +
              "Variables have names and can store different types of data like numbers or text. " +
              "In JavaScript, you declare a variable using let, const, or var."
    },
    {
        category: "programming",
        text: "A function is a reusable block of code that performs a specific task. " +
              "Functions can take inputs called parameters and return outputs. " +
              "They help organize code and avoid repetition."
    }
];

/**
 * Category colors for visual clustering
 */
const CATEGORY_COLORS = {
    physics: { r: 100, g: 200, b: 255 },   // Blue
    math: { r: 255, g: 200, b: 100 },      // Orange
    biology: { r: 100, g: 255, b: 150 },   // Green
    history: { r: 255, g: 180, b: 200 },   // Pink
    language: { r: 200, g: 150, b: 255 },  // Purple
    programming: { r: 255, g: 255, b: 100 } // Yellow
};

async function buildArchive() {
    console.log('📚 Building Archive Continent...\n');

    const manifest = {
        metadata: {
            created: new Date().toISOString(),
            totalDocuments: SAMPLE_TRAINING_DATA.length,
            offset: { x: ARCHIVE_OFFSET_X, y: ARCHIVE_OFFSET_Y }
        },
        documents: [],
        embeddings: {}
    };

    // We'll build a simple pixel buffer representation
    // In production, this would write to InfiniteMap
    const pixels = new Map(); // "x,y" -> [r, g, b, a]

    function setPixel(x, y, r, g, b, a = 255) {
        pixels.set(`${x},${y}`, [r, g, b, a]);
    }

    // Process each document
    SAMPLE_TRAINING_DATA.forEach((doc, index) => {
        console.log(`📄 Processing [${doc.category}]: ${doc.text.slice(0, 40)}...`);

        // Generate embedding
        const embedding = embedText(doc.text);
        const embeddingKey = `doc_${index}`;

        // Project to 2D coordinates
        const coords = projectTo2D(embedding, index, SAMPLE_TRAINING_DATA.length);

        // Add category-based offset for visual clustering
        const categoryOffset = Object.keys(CATEGORY_COLORS).indexOf(doc.category) || 0;
        const finalX = coords.x + categoryOffset * 200;
        const finalY = coords.y;

        // Render text to pixels
        const positions = renderTextToPixels(doc.text, finalX, finalY, { setPixel });

        // Add boundary marker (category color glow)
        const catColor = CATEGORY_COLORS[doc.category] || { r: 128, g: 128, b: 128 };
        for (let dx = -2; dx < 82; dx++) {
            for (let dy = -2; dy < Math.ceil(positions.length / 80) + 4; dy++) {
                if (dx < 0 || dx >= 80 || dy < 0 || dy >= Math.ceil(positions.length / 80)) {
                    setPixel(
                        finalX + dx,
                        finalY + dy,
                        catColor.r,
                        catColor.g,
                        catColor.b,
                        100 // Semi-transparent border
                    );
                }
            }
        }

        // Store in manifest
        manifest.documents.push({
            id: index,
            category: doc.category,
            text: doc.text,
            coords: { x: finalX, y: finalY },
            dimensions: {
                width: 80,
                height: Math.ceil(positions.length / 80)
            },
            embeddingKey
        });

        manifest.embeddings[embeddingKey] = Array.from(embedding);
    });

    // Save manifest
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`\n✅ Archive manifest saved: ${MANIFEST_PATH}`);

    // Save pixel data as a simple format
    const pixelData = {
        width: ARCHIVE_OFFSET_X + 3000,
        height: 2500,
        pixels: Object.fromEntries(pixels)
    };
    writeFileSync(
        join(ARCHIVE_DIR, 'archive_pixels.json'),
        JSON.stringify(pixelData)
    );

    console.log(`📊 Statistics:`);
    console.log(`   Documents: ${manifest.documents.length}`);
    console.log(`   Total pixels: ${pixels.size}`);
    console.log(`   Categories: ${Object.keys(CATEGORY_COLORS).length}`);
    console.log(`\n🗺️  Archive continent coordinates: (${ARCHIVE_OFFSET_X}, ${ARCHIVE_OFFSET_Y})`);

    return manifest;
}

// Run
buildArchive().catch(console.error);
