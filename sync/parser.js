// parser.js - Strict Compliance ASCII Parser (shared between GUI and Server)

export class AsciiParser {
    constructor() {
        this.elements = {
            buttons: [],
            statuses: [],
            tables: [],
            cards: [],
            text: []
        };
        this.hash = null;
        this.title = null;
    }

    parse(ascii) {
        this.elements = { buttons: [], statuses: [], tables: [], cards: [], text: [] };
        this.hash = null;
        this.title = null;

        const lines = ascii.split('\n');

        // Extract hash from header
        const hashMatch = ascii.match(/ver:([a-f0-9]{8})/i);
        if (hashMatch) {
            this.hash = hashMatch[1].toLowerCase();
        }

        // Extract title from first ╔...║ line
        const titleMatch = ascii.match(/╔[═]+╗\n║\s*(.+?)\s+ver:/);
        if (titleMatch) {
            this.title = titleMatch[1].trim();
        }

        // Parse each line
        let inTable = false;
        let tableLines = [];
        let inCard = false;
        let cardTitle = null;
        let cardContent = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Skip box drawing borders for content detection
            if (this.isBorderLine(line)) {
                // Check for card boundaries
                if (line.trim().startsWith('┌') && !inCard) {
                    inCard = true;
                    cardTitle = null;
                    cardContent = [];
                    continue;
                }
                if (line.includes('├') && inCard && !cardTitle) {
                    // Next lines are card content
                    continue;
                }
                if (line.trim().startsWith('└') && inCard) {
                    // End of card
                    if (cardTitle) {
                        this.elements.cards.push({
                            title: cardTitle,
                            content: cardContent.join('\n').trim()
                        });
                    }
                    inCard = false;
                    cardTitle = null;
                    cardContent = [];
                    continue;
                }
                continue;
            }

            // Inside card - first non-border line is title
            if (inCard && !cardTitle && line.trim()) {
                cardTitle = line.trim();
                continue;
            }

            // Card content
            if (inCard && cardTitle) {
                cardContent.push(line);
                continue;
            }

            // Parse buttons: [A] Label
            const buttonMatches = [...line.matchAll(/\[([A-Z0-9])\]\s*(.+?)(?=\s{2}|\s*\[|\s*║|$)/g)];
            for (const match of buttonMatches) {
                this.elements.buttons.push({
                    key: match[1],
                    label: match[2].trim()
                });
            }

            // Parse status indicators
            const statusSymbols = {
                '●': 'running',
                '○': 'stopped',
                '◐': 'warning',
                '◑': 'paused',
                '◉': 'error'
            };

            for (const [symbol, state] of Object.entries(statusSymbols)) {
                const regex = new RegExp(symbol + '(?:\\s+(\\w+))?', 'g');
                let match;
                while ((match = regex.exec(line)) !== null) {
                    this.elements.statuses.push({
                        symbol,
                        state,
                        context: match[1] || ''
                    });
                }
            }

            // Parse tables (lines with │ separators)
            if (line.includes('│')) {
                if (!inTable) {
                    inTable = true;
                    tableLines = [];
                }
                // Strip outer borders if nested
                const content = line.replace(/^║|║$/g, '');
                // Skip separator lines
                if (!content.match(/^[\s│├└┌─]+$/)) {
                    tableLines.push(content);
                }
            } else if (inTable) {
                // End of table
                if (tableLines.length >= 1) {
                    this.elements.tables.push(this.parseTable(tableLines));
                }
                inTable = false;
                tableLines = [];
            }

            // Parse plain text (lines with content but no special patterns)
            if (this.isPlainText(line)) {
                const trimmed = line.trim();
                if (trimmed) {
                    this.elements.text.push(trimmed);
                }
            }
        }

        // Handle remaining table
        if (inTable && tableLines.length >= 2) {
            this.elements.tables.push(this.parseTable(tableLines));
        }

        return this.elements;
    }

    isBorderLine(line) {
        return /^[╔╗╚╝║═┌┐└┘│─├┤┬┴┼]+$/.test(line.trim());
    }

    isPlainText(line) {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (this.isBorderLine(line)) return false;
        if (/\[([A-Z0-9])\]/.test(trimmed)) return false;
        if (/[●○◐◑◉]/.test(trimmed)) return false;
        if (trimmed.includes('│')) return false;
        return true;
    }

    parseTable(lines) {
        const rows = lines.map(line => {
            // Split by │ first
            let cells = line.split('│')
                .map(cell => cell.trim())
                .filter(cell => cell.length > 0);
            
            // If only one cell, try splitting by 2 or more spaces (smart split)
            if (cells.length === 1 && cells[0].includes('  ')) {
                cells = cells[0].split(/\s{2,}/).map(c => c.trim());
            }
            return cells;
        }).filter(row => row.length > 0);

        return {
            headers: rows[0] || [],
            rows: rows.slice(1)
        };
    }

    getReport() {
        return {
            hash: this.hash,
            title: this.title,
            elements: {
                buttons: this.elements.buttons.map(b => ({ key: b.key, label: b.label })),
                statuses: this.elements.statuses.map(s => ({ symbol: s.symbol, state: s.state, context: s.context })),
                tables: this.elements.tables.map(t => ({ rows: t.rows.length + 1, cols: t.headers.length })),
                cards: this.elements.cards.map(c => ({ title: c.title })),
                textCount: this.elements.text.length
            }
        };
    }
}
