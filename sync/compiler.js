// compiler.js - Translates ASCII AST into existing programming languages

export class AsciiCompiler {
    constructor(ast) {
        this.ast = ast;
    }

    /**
     * Generate React (JSX) component code
     */
    toReact(componentName = 'AsciiInterface') {
        let imports = `import React, { useState } from 'react';\n`;
        imports += `import './AsciiInterface.css'; // Assume strict compliance styles here\n\n`;

        let body = `export default function ${componentName}({ onAction }) {\n`;
        
        // State for statuses if needed
        body += `    // Renderers\n`;
        
        let renderContent = `    return (\n        <div className="ascii-container">\n`;

        // Render Cards
        if (this.ast.cards && this.ast.cards.length > 0) {
            for (const card of this.ast.cards) {
                renderContent += `            <div className="ascii-card">\n`;
                if (card.title) {
                    renderContent += `                <div className="ascii-card-title">${card.title}</div>\n`;
                }
                renderContent += `                <div className="ascii-card-content">\n`;
                renderContent += `                    {/* Card content: ${card.content.replace(/\n/g, ' ')} */}\n`;
                renderContent += `                    <pre>{${JSON.stringify(card.content)}}</pre>\n`;
                renderContent += `                </div>\n            </div>\n`;
            }
        }

        // Render Tables
        if (this.ast.tables && this.ast.tables.length > 0) {
            for (const table of this.ast.tables) {
                renderContent += `            <table className="ascii-table">\n`;
                renderContent += `                <thead>\n                    <tr>\n`;
                for (const th of table.headers) {
                    renderContent += `                        <th>${th}</th>\n`;
                }
                renderContent += `                    </tr>\n                </thead>\n`;
                renderContent += `                <tbody>\n`;
                for (const row of table.rows) {
                    renderContent += `                    <tr>\n`;
                    for (const td of row) {
                        renderContent += `                        <td>${td}</td>\n`;
                    }
                    renderContent += `                    </tr>\n`;
                }
                renderContent += `                </tbody>\n            </table>\n`;
            }
        }

        // Render Statuses
        if (this.ast.statuses && this.ast.statuses.length > 0) {
            renderContent += `            <div className="status-bar">\n`;
            for (const status of this.ast.statuses) {
                renderContent += `                <span className={\`status-indicator status-\${'${status.state}'}\`}>\n`;
                renderContent += `                    ${status.symbol} ${status.context}\n`;
                renderContent += `                </span>\n`;
            }
            renderContent += `            </div>\n`;
        }

        // Render Buttons
        if (this.ast.buttons && this.ast.buttons.length > 0) {
            renderContent += `            <div className="button-bar">\n`;
            for (const btn of this.ast.buttons) {
                renderContent += `                <button className="ascii-button" onClick={() => onAction('${btn.key}', '${btn.label}')}>\n`;
                renderContent += `                    <kbd>${btn.key}</kbd> ${btn.label}\n`;
                renderContent += `                </button>\n`;
            }
            renderContent += `            </div>\n`;
        }
        
        // Render Plain Text
        if (this.ast.text && this.ast.text.length > 0 && this.ast.buttons.length === 0 && this.ast.tables.length === 0 && this.ast.cards.length === 0 && this.ast.statuses.length === 0) {
            for (const t of this.ast.text) {
                renderContent += `            <div className="ascii-text">${t}</div>\n`;
            }
        }

        renderContent += `        </div>\n    );\n}\n`;

        return imports + body + renderContent;
    }

    /**
     * Generate Vanilla JavaScript code (DOM API)
     */
    toVanillaJS(containerId = 'app') {
        let code = `// Auto-generated Vanilla JS interface\n`;
        code += `function renderAsciiInterface(containerId) {\n`;
        code += `    const container = document.getElementById(containerId);\n`;
        code += `    container.innerHTML = '';\n\n`;

        if (this.ast.buttons && this.ast.buttons.length > 0) {
            code += `    const buttonBar = document.createElement('div');\n`;
            code += `    buttonBar.className = 'button-bar';\n`;
            for (const btn of this.ast.buttons) {
                code += `    const btn_${btn.key} = document.createElement('button');\n`;
                code += `    btn_${btn.key}.className = 'ascii-button';\n`;
                code += `    btn_${btn.key}.innerHTML = '<kbd>${btn.key}</kbd> ${btn.label}';\n`;
                code += `    btn_${btn.key}.onclick = () => console.log('Action: ${btn.label}');\n`;
                code += `    buttonBar.appendChild(btn_${btn.key});\n`;
            }
            code += `    container.appendChild(buttonBar);\n\n`;
        }

        if (this.ast.tables && this.ast.tables.length > 0) {
            // Simplified table generation for vanilla JS example
            code += `    const tableContainer = document.createElement('div');\n`;
            code += `    tableContainer.innerHTML = \`\n`;
            for (const table of this.ast.tables) {
                code += `        <table class="ascii-table">\n`;
                code += `            <thead><tr>${table.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>\n`;
                code += `            <tbody>\n`;
                for (const row of table.rows) {
                    code += `                <tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>\n`;
                }
                code += `            </tbody>\n`;
                code += `        </table>\n`;
            }
            code += `    \`;\n`;
            code += `    container.appendChild(tableContainer);\n\n`;
        }

        code += `}\n\n`;
        code += `// Initialize\n`;
        code += `renderAsciiInterface('${containerId}');\n`;

        return code;
    }

    /**
     * Generate Python (Textual framework) code
     */
    toPythonTextual() {
        let code = `from textual.app import App, ComposeResult\n`;
        code += `from textual.widgets import Button, Static, DataTable, Label\n`;
        code += `from textual.containers import Horizontal, Vertical\n\n`;

        code += `class AsciiApp(App):\n`;
        code += `    CSS = """\n`;
        code += `    .button-bar { height: auto; }\n`;
        code += `    """\n\n`;

        code += `    def compose(self) -> ComposeResult:\n`;
        
        if (this.ast.tables && this.ast.tables.length > 0) {
            code += `        yield DataTable(id="data_table")\n`;
        }

        if (this.ast.buttons && this.ast.buttons.length > 0) {
            code += `        with Horizontal(classes="button-bar"):\n`;
            for (const btn of this.ast.buttons) {
                code += `            yield Button("${btn.label}", id="btn_${btn.key.toLowerCase()}")\n`;
            }
        }
        
        code += `\n    def on_mount(self) -> None:\n`;
        if (this.ast.tables && this.ast.tables.length > 0) {
            code += `        table = self.query_one(DataTable)\n`;
            const headers = this.ast.tables[0].headers.map(h => `"${h}"`).join(', ');
            code += `        table.add_columns(${headers})\n`;
            for (const row of this.ast.tables[0].rows) {
                const rowData = row.map(c => `"${c}"`).join(', ');
                code += `        table.add_row(${rowData})\n`;
            }
        } else {
            code += `        pass\n`;
        }

        if (this.ast.buttons && this.ast.buttons.length > 0) {
            code += `\n    def on_button_pressed(self, event: Button.Pressed) -> None:\n`;
            code += `        print(f"Action triggered: {event.button.id}")\n`;
        }

        code += `\nif __name__ == "__main__":\n`;
        code += `    app = AsciiApp()\n`;
        code += `    app.run()\n`;

        return code;
    }
}
