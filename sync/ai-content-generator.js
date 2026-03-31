// sync/ai-content-generator.js
// AI content generation pipeline — template-based, no external API calls

// ── Content Templates ────────────────────────────────────────

export const CONTENT_TEMPLATES = {
    portfolio: {
        structure: [
            { section: 'hero', heading: 'Welcome to My Portfolio' },
            { section: 'projects', heading: 'Projects', renderAs: 'list' },
            { section: 'contact', heading: 'Get In Touch', renderAs: 'text' },
        ],
        defaultRenderAs: 'heading',
        tone: 'professional',
    },
    blog: {
        structure: [
            { section: 'title', renderAs: 'heading' },
            { section: 'date', renderAs: 'text' },
            { section: 'body', renderAs: 'text' },
            { section: 'tags', renderAs: 'list' },
        ],
        defaultRenderAs: 'text',
        tone: 'conversational',
    },
    landing: {
        structure: [
            { section: 'headline', heading: 'Headline', renderAs: 'heading' },
            { section: 'features', heading: 'Features', renderAs: 'list' },
            { section: 'cta', heading: 'Call to Action', renderAs: 'text' },
        ],
        defaultRenderAs: 'heading',
        tone: 'persuasive',
    },
    docs: {
        structure: [
            { section: 'heading', renderAs: 'heading' },
            { section: 'body', renderAs: 'text' },
            { section: 'code', renderAs: 'code' },
        ],
        defaultRenderAs: 'heading',
        tone: 'informative',
    },
    gallery: {
        structure: [
            { section: 'grid', heading: 'Gallery', renderAs: 'text' },
            { section: 'images', renderAs: 'list' },
        ],
        defaultRenderAs: 'text',
        tone: 'visual',
    },
};

// ── Template body generators ─────────────────────────────────

const BODY_GENERATORS = {
    portfolio(description) {
        return [
            `# Welcome to My Portfolio`,
            '',
            `## Projects`,
            '',
            ...extractProjectCards(description),
            '',
            '## Get In Touch',
            '',
            'Interested in collaborating? Reach out to discuss your next project.',
        ].join('\n');
    },
    blog(description) {
        const date = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
        return [
            `Published on ${date}`,
            '',
            ...extractParagraphs(description),
        ].join('\n');
    },
    landing(description) {
        return [
            `# ${extractHeadline(description)}`,
            '',
            '## Features',
            '',
            ...extractFeatureList(description),
            '',
            '## Get Started Today',
            '',
            'Ready to take the next step? Sign up now and experience the difference.',
        ].join('\n');
    },
    docs(description) {
        return [
            `# Documentation`,
            '',
            ...extractParagraphs(description),
            '',
            '## Example',
            '',
            '```',
            '// Example usage',
            'const result = initialize(config);',
            'console.log(result);',
            '```',
        ].join('\n');
    },
    gallery(description) {
        return [
            '# Gallery',
            '',
            'A curated collection showcasing visual work and creative projects.',
            '',
            '## Collection',
            '',
            '- [Image 1] Placeholder for project showcase',
            '- [Image 2] Placeholder for design work',
            '- [Image 3] Placeholder for creative output',
            '- [Image 4] Placeholder for visual experiment',
        ].join('\n');
    },
};

// ── Keyword matching helpers ─────────────────────────────────

const TEMPLATE_KEYWORDS = {
    portfolio: ['portfolio', 'project', 'showcase', 'work sample', 'resume', 'cv', 'bio'],
    blog:      ['blog', 'post', 'article', 'story', 'opinion', 'diary', 'journal', 'write-up'],
    landing:   ['landing', 'product', 'service', 'startup', 'launch', 'offer', 'marketing', 'campaign'],
    docs:      ['docs', 'documentation', 'guide', 'tutorial', 'manual', 'reference', 'how-to', 'api'],
    gallery:   ['gallery', 'photo', 'image', 'visual', 'art', 'portfolio showcase', 'creative'],
};

function detectTemplate(description) {
    const lower = description.toLowerCase();
    let bestMatch = 'blog'; // default
    let bestScore = 0;

    for (const [template, keywords] of Object.entries(TEMPLATE_KEYWORDS)) {
        let score = 0;
        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                score += keyword.length; // longer matches score higher
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = template;
        }
    }

    return bestMatch;
}

// ── Text extraction helpers ──────────────────────────────────

function extractHeadline(description) {
    // Try to use the first sentence as a headline
    const match = description.match(/^(.+?)[.!?](?:\s|$)/);
    if (match) {
        return match[1].trim();
    }
    // Fallback: first 60 chars
    return description.slice(0, 60).trim();
}

function extractParagraphs(description) {
    const sentences = description
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0);

    if (sentences.length === 0) {
        return [description];
    }

    // Group into paragraphs of ~3 sentences
    const paragraphs = [];
    for (let i = 0; i < sentences.length; i += 3) {
        paragraphs.push(sentences.slice(i, i + 3).join(' '));
    }
    return paragraphs;
}

function extractFeatureList(description) {
    const sentences = description
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0);

    if (sentences.length <= 1) {
        return ['- Feature: ' + description.trim()];
    }

    return sentences.slice(0, Math.min(sentences.length, 5)).map(s =>
        `- ${s.trim()}`
    );
}

function extractProjectCards(description) {
    const sentences = description
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 0);

    if (sentences.length <= 1) {
        return ['- **Project**: ' + description.trim()];
    }

    return sentences.slice(0, Math.min(sentences.length, 4)).map(s =>
        `- **Project**: ${s.trim()}`
    );
}

function extractTags(description, extraTags = []) {
    const tags = [...extraTags];
    const lower = description.toLowerCase();

    const tagMap = {
        'web': ['web'], 'design': ['design'], 'code': ['coding'],
        'javascript': ['javascript'], 'python': ['python'], 'react': ['react'],
        'api': ['api'], 'mobile': ['mobile'], 'data': ['data'],
        'ai': ['ai'], 'tutorial': ['tutorial'], 'guide': ['guide'],
    };

    for (const [keyword, tag] of Object.entries(tagMap)) {
        if (lower.includes(keyword) && !tags.includes(tag[0])) {
            tags.push(tag[0]);
        }
    }

    // Ensure at least one tag
    if (tags.length === 0) {
        tags.push('general');
    }

    return tags;
}

// ── AiContentGenerator class ─────────────────────────────────

export class AiContentGenerator {
    /**
     * @param {Object} options
     * @param {import('./content-store.js').ContentStore} options.contentStore
     * @param {string} [options.aiEndpoint] - Placeholder for future API integration
     * @param {string} [options.model] - Placeholder for model selection
     */
    constructor({ contentStore, aiEndpoint, model } = {}) {
        if (!contentStore) {
            throw new Error('contentStore is required');
        }
        this.contentStore = contentStore;
        this.aiEndpoint = aiEndpoint || null;
        this.model = model || 'template-v1';
    }

    /**
     * Generate structured content from a natural language description.
     * Uses template matching (keyword detection) — no external API calls.
     *
     * @param {string} description - Natural language content description
     * @param {Object} [options]
     * @param {string} [options.template] - Force a specific template
     * @param {string} [options.type] - Content type override: 'page' or 'post'
     * @param {string[]} [options.tags] - Additional tags
     * @returns {{ title: string, body: string, type: 'page'|'post', metadata: { template: string, renderAs: string, tags: string[] } }}
     */
    generateFromDescription(description, options = {}) {
        if (!description || typeof description !== 'string') {
            throw new Error('description must be a non-empty string');
        }

        const templateName = options.template || detectTemplate(description);
        const template = CONTENT_TEMPLATES[templateName];

        if (!template) {
            throw new Error(`Unknown template: ${templateName}`);
        }

        // Determine content type based on template
        let type = options.type || null;
        if (!type) {
            type = (templateName === 'blog') ? 'post' : 'page';
        }

        // Generate title from description
        const title = extractHeadline(description);

        // Generate body using the template's body generator
        const generator = BODY_GENERATORS[templateName];
        const body = generator ? generator(description) : description;

        // Determine primary renderAs from template
        const renderAs = template.defaultRenderAs;

        // Build tags
        const tags = extractTags(description, options.tags || []);

        return {
            title,
            body,
            type,
            metadata: {
                template: templateName,
                renderAs,
                tags,
            },
        };
    }

    /**
     * Generate a full page content item and save to the content store.
     *
     * @param {string} title - Page title
     * @param {string} description - Natural language description of page content
     * @param {string} [template='default'] - Template name to use
     * @returns {import('./content-store.js').ContentItem}
     */
    generatePage(title, description, template = 'default') {
        if (!title || typeof title !== 'string') {
            throw new Error('title must be a non-empty string');
        }
        if (!description || typeof description !== 'string') {
            throw new Error('description must be a non-empty string');
        }

        const resolvedTemplate = template === 'default'
            ? detectTemplate(description)
            : template;

        const generated = this.generateFromDescription(description, {
            template: resolvedTemplate,
            type: 'page',
        });

        // Override generated title with the explicit one
        const item = this.contentStore.create({
            type: 'page',
            title,
            body: generated.body,
            metadata: generated.metadata,
        });

        return item;
    }

    /**
     * Generate a blog post content item and save to the content store.
     *
     * @param {string} title - Post title
     * @param {string} description - Natural language description of post content
     * @param {string[]} [tags=[]] - Tags for the post
     * @returns {import('./content-store.js').ContentItem}
     */
    generatePost(title, description, tags = []) {
        if (!title || typeof title !== 'string') {
            throw new Error('title must be a non-empty string');
        }
        if (!description || typeof description !== 'string') {
            throw new Error('description must be a non-empty string');
        }

        const generated = this.generateFromDescription(description, {
            template: 'blog',
            type: 'post',
            tags,
        });

        const item = this.contentStore.create({
            type: 'post',
            title,
            body: generated.body,
            metadata: generated.metadata,
        });

        return item;
    }
}
