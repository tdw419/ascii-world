// scripts/test-render-api.js
// Tests the new multi-renderer HTTP endpoints

async function testRenderAPI() {
    const port = 3839;
    const baseURL = `http://localhost:${port}/api/v1/render`;

    const sampleASCII = `╔══════════════════════╗
║ API TEST             ║
╠══════════════════════╣
║ status : ● ONLINE    ║
║ level  : ▓▓▓▓░░░░░░  ║
╚══════════════════════╝`;

    const formats = ['html', 'python', 'svg', 'png'];

    console.log(`Testing pxOS Render API on ${baseURL}...\n`);

    for (const format of formats) {
        try {
            console.log(`[${format.toUpperCase()}] Requesting...`);
            const response = await fetch(`${baseURL}/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: sampleASCII })
            });

            if (!response.ok) {
                console.error(`  ✗ Failed: ${response.status} ${response.statusText}`);
                continue;
            }

            const contentType = response.headers.get('Content-Type');
            console.log(`  ✓ Success! Content-Type: ${contentType}`);
            
            if (format === 'png') {
                const blob = await response.blob();
                console.log(`  ✓ Received ${blob.size} bytes of image data`);
            } else {
                const text = await response.text();
                console.log(`  ✓ Received ${text.length} characters of output`);
                // console.log(text.substring(0, 100) + '...');
            }
        } catch (err) {
            console.error(`  ✗ Error: ${err.message}`);
        }
    }
}

testRenderAPI();
