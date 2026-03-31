// sync/renderers/markdown.js
// ASCII → Markdown renderer
// Projects Stratum 1 (ASCII cells) to GitHub-flavored Markdown

/**
 * Render ASCII content to Markdown.
 * @param {string} asciiContent - The ASCII substrate (80x24 grid)
 * @param {object} options - Rendering options
 * @param {string} options.title - Document title
 * @param {boolean} options.includeMetadata - Include metadata section
 * @returns {string} Markdown string
 */
export function renderToMarkdown(asciiContent, options = {}) {
    const { title = 'ASCII World Substrate', includeMetadata = false } = options;
    
    let md = '';

    if (title) {
        md += `# ${title}\n\n`;
    }

    // Code block with ASCII
    md += '```text\n';
    md += asciiContent;
    if (!asciiContent.endsWith('\n')) md += '\n';
    md += '```\n';

    if (includeMetadata) {
        md += '\n## Metadata\n\n';
        md += `- **Generated**: ${new Date().toISOString()}\n`;
        md += `- **Dimensions**: ${asciiContent.split('\n').length} rows\n`;
        md += `- **Format**: ASCII World Substrate 1.0\n`;
    }

    return md;
}

export default renderToMarkdown;
