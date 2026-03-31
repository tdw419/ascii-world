// sync/publish/static-site-generator.js
// Generates a complete static site from all published pages.
// Each page becomes an HTML file, index.html with navigation,
// assets copied to assets/, output directory is deploy-ready.

import { mkdirSync, writeFileSync, existsSync, readdirSync, copyFileSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { compileHTML, compileAllHTML } from './html-compiler.js';
import { DEFAULT_THEME } from '../theme-editor.js';

/**
 * @typedef {Object} SSGOptions
 * @property {string} outputDir       - Output directory path
 * @property {Object|null} [theme]    - Theme overrides
 * @property {string} [siteName]      - Site name for index page
 * @property {string} [siteUrl]       - Base URL for links
 * @property {boolean} [clean=true]   - Clean output dir before generating
 */

/**
 * Generate a complete static site.
 * @param {import('../content-store.js').ContentStore} contentStore
 * @param {import('../router.js').Router} router
 * @param {SSGOptions} options
 * @returns {{ pages: number, assets: string[], outputDir: string }}
 */
export function generateStaticSite(contentStore, router, options) {
    if (!options || !options.outputDir) {
        throw new Error('outputDir is required');
    }

    const {
        theme = null,
        siteName = 'ASCII World',
        siteUrl = '',
        clean = true,
    } = options;

    const outputDir = options.outputDir;

    // Create directory structure
    const assetsDir = join(outputDir, 'assets');
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(assetsDir, { recursive: true });

    // Get all pages and navigation
    const manifests = contentStore.listManifests();
    const navTree = router.getNavigationTree();
    const activeTheme = theme || DEFAULT_THEME;

    // Compile all pages
    const compiledPages = compileAllHTML(contentStore, router, {
        theme: activeTheme,
        navigationTree: navTree,
    });

    // Write each page as {slug}.html
    let pageCount = 0;
    for (const [slug, html] of compiledPages) {
        const pageDir = join(outputDir, slug);
        mkdirSync(pageDir, { recursive: true });
        const filePath = join(pageDir, 'index.html');
        writeFileSync(filePath, html, 'utf-8');
        pageCount++;
    }

    // Generate index.html with site navigation
    const indexHTML = generateIndexPage(navTree, manifests, {
        theme: activeTheme,
        siteName,
        siteUrl,
    });
    writeFileSync(join(outputDir, 'index.html'), indexHTML, 'utf-8');
    pageCount++;

    // Generate 404 page
    const notFoundHTML = generate404Page(navTree, {
        theme: activeTheme,
        siteName,
    });
    writeFileSync(join(outputDir, '404.html'), notFoundHTML, 'utf-8');

    // Copy any assets from content metadata
    const assetsCopied = copyContentAssets(contentStore, outputDir, assetsDir);

    return {
        pages: pageCount,
        assets: assetsCopied,
        outputDir,
    };
}

/**
 * Generate the site index page.
 */
function generateIndexPage(navTree, manifests, options) {
    const { theme, siteName, siteUrl } = options;
    const cssVars = themeToInlineCSS(theme);

    const navItems = navTree.map(item => {
        const children = item.children && item.children.length > 0
            ? item.children.map(c =>
                `<li><a href="/${c.slug}/">${escapeHTML(c.title)}</a></li>`
            ).join('')
            : '';
        return `<li>
            <a href="/${item.slug}/" class="page-link">${escapeHTML(item.title)}</a>
            ${children ? `<ul class="children">${children}</ul>` : ''}
        </li>`;
    }).join('\n');

    const recentPages = manifests
        .sort((a, b) => b.updated_at - a.updated_at)
        .slice(0, 10)
        .map(m => `<li>
            <a href="/${m.slug}/">${escapeHTML(m.title)}</a>
            <span class="date">${new Date(m.updated_at).toISOString().split('T')[0]}</span>
        </li>`)
        .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(siteName)}</title>
<style>
:root {
  --bg: ${cssVars.bg};
  --fg: ${cssVars.fg};
  --border: ${cssVars.border};
  --link: ${cssVars.linkFg};
  --heading: ${cssVars.headingFg};
  --mono: 'Courier New', Courier, monospace;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: var(--mono);
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1rem;
  line-height: 1.5;
}
h1 {
  color: var(--heading);
  border-bottom: 2px solid var(--border);
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
.pages { list-style: none; margin-top: 1rem; }
.pages li { padding: 0.3rem 0; border-bottom: 1px solid var(--border); }
.pages .date { float: right; opacity: 0.5; font-size: 0.85em; }
.children { list-style: none; padding-left: 1.5rem; margin-top: 0.3rem; }
.children li { border: none; }
footer { margin-top: 2rem; opacity: 0.4; font-size: 0.8em; text-align: center; }
</style>
</head>
<body>
<h1>${escapeHTML(siteName)}</h1>

${navTree.length > 0 ? `<h2>Pages</h2>
<ul class="pages">
${navItems}
</ul>` : '<p>No pages yet.</p>'}

${manifests.length > 0 ? `<h2>Recent</h2>
<ul class="pages">
${recentPages}
</ul>` : ''}

<footer>Generated by ASCII World CMS Static Site Generator</footer>
</body>
</html>`;
}

/**
 * Generate a 404 error page.
 */
function generate404Page(navTree, options) {
    const { theme, siteName } = options;
    const cssVars = themeToInlineCSS(theme);

    const navItems = navTree.map(item =>
        `<li><a href="/${item.slug}/">${escapeHTML(item.title)}</a></li>`
    ).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>404 — ${escapeHTML(siteName)}</title>
<style>
body {
  background: ${cssVars.bg};
  color: ${cssVars.fg};
  font-family: 'Courier New', monospace;
  max-width: 600px;
  margin: 4rem auto;
  padding: 1rem;
  text-align: center;
}
h1 { color: ${cssVars.heading}; }
a { color: ${cssVars.linkFg}; }
</style>
</head>
<body>
<h1>404</h1>
<p>Page not found.</p>
${navTree.length > 0 ? `<ul style="list-style:none;margin-top:2rem;">${navItems}</ul>` : ''}
<p><a href="/">Home</a></p>
</body>
</html>`;
}

/**
 * Copy content assets referenced in metadata.
 * Looks for 'assets' array in page manifest metadata.
 */
function copyContentAssets(contentStore, outputDir, assetsDir) {
    const copied = [];
    const manifests = contentStore.listManifests();

    for (const manifest of manifests) {
        const assetPaths = manifest.metadata && manifest.metadata.assets;
        if (Array.isArray(assetPaths)) {
            for (const assetPath of assetPaths) {
                if (typeof assetPath === 'string' && existsSync(assetPath)) {
                    const destPath = join(assetsDir, basename(assetPath));
                    try {
                        copyFileSync(assetPath, destPath);
                        copied.push(basename(assetPath));
                    } catch {}
                }
            }
        }
    }

    return copied;
}

/**
 * Convert theme to simple inline CSS values.
 */
function themeToInlineCSS(theme) {
    return {
        bg: rgbaToCSS(theme.bg),
        fg: rgbaToCSS(theme.fg),
        border: rgbaToCSS(theme.border),
        linkFg: rgbaToCSS(theme.linkFg),
        headingFg: rgbaToCSS(theme.headingFg),
    };
}

function rgbaToCSS(rgba) {
    if (!Array.isArray(rgba) || rgba.length < 3) return 'rgba(0,0,0,1)';
    const [r, g, b, a = 255] = rgba;
    return `rgba(${r},${g},${b},${(a / 255).toFixed(2)})`;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
