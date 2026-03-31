// sync/ai-architect.js
// AI Site Architect — natural language to full site generation.
// Part of CMS Phase 5.3 — AI Site Architect
//
// Takes a high-level site description and generates:
//   - Page structure (home, about, blog, etc.)
//   - Content for each page
//   - Theme selection and configuration
//   - Plugin activation
//   - Navigation setup
//
// Returns a full site manifest that can be applied to the CMS.

import { THEME_PRESETS, DEFAULT_THEME } from './theme-editor.js';

/**
 * Site type templates — maps description keywords to site structures.
 */
const SITE_TEMPLATES = {
    portfolio: {
        pages: [
            { title: 'Home', slug: 'home', layout: 'hero', sections: ['hero', 'featured-projects', 'call-to-action'] },
            { title: 'About', slug: 'about', layout: 'full', sections: ['bio', 'skills', 'experience'] },
            { title: 'Projects', slug: 'projects', layout: 'grid', sections: ['project-gallery'] },
            { title: 'Contact', slug: 'contact', layout: 'full', sections: ['contact-form'] },
        ],
        theme: 'default',
        plugins: ['nav-menu', 'media-gallery', 'contact-form'],
        navStyle: 'horizontal',
    },
    blog: {
        pages: [
            { title: 'Home', slug: 'home', layout: 'blog-list', sections: ['recent-posts', 'featured'] },
            { title: 'About', slug: 'about', layout: 'full', sections: ['about-text'] },
            { title: 'Blog', slug: 'blog', layout: 'blog-list', sections: ['post-list'] },
            { title: 'Contact', slug: 'contact', layout: 'full', sections: ['contact-form'] },
        ],
        theme: 'solarized',
        plugins: ['nav-menu', 'content-editor', 'analytics'],
        navStyle: 'horizontal',
    },
    corporate: {
        pages: [
            { title: 'Home', slug: 'home', layout: 'hero', sections: ['hero', 'services-overview', 'testimonials'] },
            { title: 'About', slug: 'about', layout: 'full', sections: ['company-history', 'team', 'values'] },
            { title: 'Services', slug: 'services', layout: 'grid', sections: ['service-cards'] },
            { title: 'Blog', slug: 'blog', layout: 'blog-list', sections: ['recent-posts'] },
            { title: 'Contact', slug: 'contact', layout: 'full', sections: ['contact-form', 'map'] },
        ],
        theme: 'midnight',
        plugins: ['nav-menu', 'analytics', 'contact-form'],
        navStyle: 'horizontal',
    },
    landing: {
        pages: [
            { title: 'Home', slug: 'home', layout: 'hero', sections: ['hero', 'features', 'pricing', 'call-to-action', 'faq'] },
        ],
        theme: 'amber',
        plugins: ['nav-menu', 'analytics'],
        navStyle: 'horizontal',
    },
    documentation: {
        pages: [
            { title: 'Home', slug: 'home', layout: 'sidebar', sections: ['overview', 'quick-start'] },
            { title: 'Getting Started', slug: 'getting-started', layout: 'sidebar', sections: ['installation', 'configuration', 'first-steps'] },
            { title: 'API Reference', slug: 'api', layout: 'sidebar', sections: ['endpoints', 'examples'] },
            { title: 'About', slug: 'about', layout: 'full', sections: ['about-text'] },
        ],
        theme: 'terminal',
        plugins: ['nav-menu', 'content-editor'],
        navStyle: 'vertical',
    },
    gallery: {
        pages: [
            { title: 'Home', slug: 'home', layout: 'hero', sections: ['hero', 'featured-gallery'] },
            { title: 'Gallery', slug: 'gallery', layout: 'grid', sections: ['image-gallery'] },
            { title: 'About', slug: 'about', layout: 'full', sections: ['artist-bio'] },
            { title: 'Contact', slug: 'contact', layout: 'full', sections: ['contact-form'] },
        ],
        theme: 'solarized',
        plugins: ['nav-menu', 'media-gallery', 'contact-form'],
        navStyle: 'horizontal',
    },
};

/**
 * Keyword mapping for site type detection.
 */
const KEYWORD_MAP = {
    portfolio: ['portfolio', 'showcase', 'personal', 'resume', 'cv', 'work samples', 'game dev', 'developer'],
    blog: ['blog', 'news', 'articles', 'posts', 'writing', 'journal', 'newsletter', 'opinion'],
    corporate: ['corporate', 'business', 'company', 'enterprise', 'professional', 'agency', 'firm', 'startup'],
    landing: ['landing', 'product', 'launch', 'startup', 'saas', 'app', 'service', 'promo', 'marketing'],
    documentation: ['documentation', 'docs', 'api', 'reference', 'manual', 'guide', 'tutorial', 'wiki'],
    gallery: ['gallery', 'art', 'photos', 'photography', 'images', 'visual', 'creative', 'designer'],
};

/**
 * Content templates for generating page body content.
 */
const CONTENT_TEMPLATES = {
    hero: (desc) =>
        `# ${desc}\n\nWelcome to our site. We bring passion and expertise to everything we do.\n\n[Get Started]  [Learn More]`,
    'about-text': (desc) =>
        `## About\n\nWe are a team dedicated to delivering exceptional results.\nOur mission is to turn ideas into reality through creativity and hard work.\n\nFounded with a vision to make a difference, we continue to push boundaries every day.`,
    bio: (desc) =>
        `## About Me\n\nI am a passionate creator with a focus on quality and innovation.\nWith years of experience, I bring a unique perspective to every project.\n\n### Skills\n- Creative Problem Solving\n- Technical Excellence\n- Collaborative Design`,
    'recent-posts': (desc) =>
        `## Latest Posts\n\nStay tuned for updates and new content.\n\n### Getting Started\nEverything you need to know to begin your journey.\n\n### Tips & Tricks\nPro tips from our experience to help you succeed.`,
    'project-gallery': (desc) =>
        `## Projects\n\nOur featured work showcases the best of what we do.\n\nEach project represents a unique challenge and creative solution.`,
    'contact-form': (desc) =>
        `## Get In Touch\n\nWe'd love to hear from you.\n\n- Email: hello@example.com\n- Phone: (555) 123-4567`,
    'services-overview': (desc) =>
        `## Our Services\n\n### Design\nBeautiful, intuitive interfaces that delight users.\n\n### Development\nRobust, scalable solutions built with modern technology.\n\n### Strategy\nData-driven approaches to maximize your impact.`,
    'featured-gallery': (desc) =>
        `## Featured Work\n\nA curated selection of our best pieces.\n\nBrowse our full collection to see more.`,
    'company-history': (desc) =>
        `## Our Story\n\nFounded with a simple idea: make great things for great people.\n\nOver the years, we've grown from a small team to a thriving operation,\nbut our commitment to quality has never changed.`,
    'team': (desc) =>
        `## Team\n\nOur diverse team brings together expertise from across the industry.\n\nTogether, we build solutions that matter.`,
    'values': (desc) =>
        `## Values\n\n- **Quality** — We never compromise on excellence\n- **Innovation** — We push boundaries constantly\n- **Integrity** — We do the right thing, always`,
    'service-cards': (desc) =>
        `## Services\n\nWe offer a range of professional services tailored to your needs.\n\nContact us to learn more about how we can help.`,
    'pricing': (desc) =>
        `## Pricing\n\n### Basic\nEssential features for getting started.\n\n### Pro\nAdvanced features for growing teams.\n\n### Enterprise\nCustom solutions for large organizations.`,
    'call-to-action': (desc) =>
        `## Ready to Get Started?\n\nJoin thousands of satisfied customers today.\n\n[Sign Up Now]`,
    'features': (desc) =>
        `## Features\n\n- Fast and responsive\n- Easy to use\n- Fully customizable\n- 24/7 support`,
    'faq': (desc) =>
        `## FAQ\n\n**Q: How do I get started?**\nA: Simply sign up and follow the quick start guide.\n\n**Q: Is there a free trial?**\nA: Yes! Try everything free for 14 days.`,
    'overview': (desc) =>
        `# ${desc}\n\nWelcome to the documentation. Use the sidebar to navigate through the available sections.`,
    'quick-start': (desc) =>
        `## Quick Start\n\n1. Install the package\n2. Configure your settings\n3. Start building`,
    'installation': (desc) =>
        `## Installation\n\nInstall with your preferred package manager and follow the setup wizard.`,
    'configuration': (desc) =>
        `## Configuration\n\nCustomize your setup with our flexible configuration options.`,
    'first-steps': (desc) =>
        `## First Steps\n\nCreate your first project and explore the available features.`,
    'endpoints': (desc) =>
        `## API Endpoints\n\nBrowse the full list of available API endpoints and their parameters.`,
    'examples': (desc) =>
        `## Examples\n\nPractical code examples to help you integrate quickly.`,
    'artist-bio': (desc) =>
        `## About the Artist\n\nA creative journey spanning years of exploration and expression.\n\nEvery piece tells a story, and every story connects us.`,
    'image-gallery': (desc) =>
        `## Gallery\n\nBrowse the full collection of works.\n\nUse arrow keys to navigate between pieces.`,
    'post-list': (desc) =>
        `## Blog Posts\n\nBrowse our latest articles and updates.\n\nSelect a post to read more.`,
    'skills': (desc) =>
        `### Skills & Expertise\n\n- Full-Stack Development\n- UI/UX Design\n- System Architecture\n- Performance Optimization`,
    'experience': (desc) =>
        `### Experience\n\nYears of hands-on experience building products that users love.\nFrom startups to enterprises, delivering quality at every scale.`,
    'map': (desc) =>
        `## Location\n\n123 Main Street\nAnytown, USA 12345`,
    'testimonials': (desc) =>
        `## What People Say\n\n> "Absolutely outstanding work. Highly recommended."\n> — Happy Client\n\n> "Professional, creative, and reliable."\n> — Satisfied Customer`,
    'featured': (desc) =>
        `## Featured\n\nCheck out our top picks and editor's choices.`,
    'featured-projects': (desc) =>
        `## Featured Projects\n\nA selection of our best and most impactful work.\n\nEach project demonstrates our commitment to quality.`,
};

/**
 * Default content generator for unknown section types.
 */
function generateDefaultContent(sectionName, siteDescription) {
    const title = sectionName
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    return `## ${title}\n\nContent for the ${title.toLowerCase()} section of ${siteDescription}.`;
}

/**
 * Generate content for a given section name.
 */
function generateSectionContent(sectionName, siteDescription) {
    const generator = CONTENT_TEMPLATES[sectionName];
    if (generator) {
        return generator(siteDescription);
    }
    return generateDefaultContent(sectionName, siteDescription);
}

/**
 * Detect site type from a description string.
 * Returns the best matching template key.
 */
function detectSiteType(description) {
    const lower = description.toLowerCase();
    let bestMatch = 'portfolio'; // default
    let bestScore = 0;

    for (const [type, keywords] of Object.entries(KEYWORD_MAP)) {
        let score = 0;
        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                score += keyword.length; // longer keyword matches score higher
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = type;
        }
    }

    return bestMatch;
}

/**
 * Layout-to-region mapping.
 * Converts abstract layout names to ContentStore-compatible layout regions.
 */
function buildLayoutRegions(layout, sections) {
    const regions = [];

    // Every page gets a header region
    regions.push({ region: 'header', contentId: null, inline: '[NAVIGATION]', formula: null });

    // Body region(s) based on layout type
    if (layout === 'grid' || layout === 'blog-list') {
        // Multiple body sections
        for (const section of sections) {
            regions.push({ region: 'body', contentId: null, inline: section, formula: null });
        }
    } else if (layout === 'sidebar') {
        // Body + sidebar
        regions.push({ region: 'body', contentId: null, inline: sections.join('\n'), formula: null });
        regions.push({ region: 'sidebar', contentId: null, inline: '[SIDEBAR_NAV]', formula: null });
    } else {
        // hero, full — single body
        const bodyContent = sections.map(s => `[${s}]`).join('\n');
        regions.push({ region: 'body', contentId: null, inline: bodyContent, formula: null });
    }

    // Footer
    regions.push({ region: 'footer', contentId: null, inline: '[FOOTER]', formula: null });

    return regions;
}

/**
 * AI Site Architect — generates a complete site from a natural language description.
 */
export class AiArchitect {
    /**
     * @param {Object} services
     * @param {import('./content-store.js').ContentStore} services.contentStore
     * @param {import('./router.js').Router} services.router
     * @param {import('./theme-editor.js').ThemeEditor} services.themeEditor
     * @param {Object} [options]
     * @param {Function} [options.pluginActivator] - Function to activate plugins by name
     */
    constructor(services, options = {}) {
        this.contentStore = services.contentStore;
        this.router = services.router;
        this.themeEditor = services.themeEditor;
        this.pluginActivator = options.pluginActivator || null;
    }

    /**
     * Generate a complete site from a natural language description.
     *
     * @param {string} description - High-level site description
     * @returns {Object} Site manifest with pages, theme, plugins, and navigation
     */
    generate(description) {
        if (!description || typeof description !== 'string') {
            throw new Error('description is required and must be a string');
        }

        const siteType = detectSiteType(description);
        const template = SITE_TEMPLATES[siteType];

        // Generate content items and page manifests
        const pages = [];
        const contentItems = [];
        const navItems = [];

        for (const pageDef of template.pages) {
            // Create content items for each section
            const pageContentIds = [];
            const sectionContents = [];

            for (const section of pageDef.sections) {
                const body = generateSectionContent(section, description);
                const contentItem = this.contentStore.create({
                    type: 'page',
                    title: `${pageDef.title} — ${section}`,
                    body,
                    metadata: { section, page: pageDef.slug },
                });
                pageContentIds.push(contentItem.id);
                sectionContents.push(body);
                contentItems.push(contentItem);
            }

            // Build layout regions
            const layout = buildLayoutRegions(pageDef.layout, pageDef.sections);
            // Bind content to the first body region
            const bodyRegion = layout.find(r => r.region === 'body');
            if (bodyRegion && pageContentIds.length > 0) {
                bodyRegion.contentId = pageContentIds[0];
                bodyRegion.inline = null;
            }

            // Create page manifest
            const manifest = this.contentStore.createManifest({
                title: pageDef.title,
                slug: pageDef.slug,
                layout,
                theme: template.theme,
                metadata: {
                    layout: pageDef.layout,
                    sections: pageDef.sections,
                    contentIds: pageContentIds,
                    generatedFrom: description,
                    siteType,
                },
            });

            // Register route
            this.router.addRoute(manifest.slug, manifest);

            pages.push(manifest);
            navItems.push({
                title: manifest.title,
                slug: manifest.slug,
                path: '/' + manifest.slug,
            });
        }

        // Apply theme
        const themeName = template.theme;
        if (this.themeEditor) {
            if (THEME_PRESETS[themeName]) {
                this.themeEditor.applyPreset(themeName);
            } else {
                this.themeEditor.setTheme(DEFAULT_THEME);
            }
        }

        // Build site manifest
        const siteManifest = {
            description,
            siteType,
            theme: themeName,
            themeData: this.themeEditor ? this.themeEditor.getTheme() : DEFAULT_THEME,
            plugins: template.plugins,
            navStyle: template.navStyle,
            pages,
            contentItems,
            navigation: navItems,
            generatedAt: Date.now(),
        };

        return siteManifest;
    }

    /**
     * Get available site templates.
     * @returns {Object} Template names and their page structures
     */
    getTemplates() {
        const result = {};
        for (const [name, tmpl] of Object.entries(SITE_TEMPLATES)) {
            result[name] = {
                pages: tmpl.pages.map(p => ({ title: p.title, slug: p.slug, layout: p.layout })),
                theme: tmpl.theme,
                plugins: [...tmpl.plugins],
            };
        }
        return result;
    }

    /**
     * Get the keyword map (for testing/debugging).
     * @returns {Object}
     */
    getKeywordMap() {
        return { ...KEYWORD_MAP };
    }
}

/**
 * Detect site type (exported for testing).
 */
export { detectSiteType, SITE_TEMPLATES, CONTENT_TEMPLATES };
