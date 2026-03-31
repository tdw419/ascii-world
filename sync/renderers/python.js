// sync/renderers/python.js
// ASCII → Python code generator
// Projects Stratum 1 (ASCII cells) to executable Python class

/**
 * Render ASCII content to Python code.
 * @param {string} asciiContent - The ASCII substrate (80x24 grid)
 * @param {object} options - Rendering options
 * @param {string} options.className - Name of the generated class
 * @param {string} options.module - Module docstring
 * @returns {string} Python code string
 */
export function renderToPython(asciiContent, options = {}) {
    const { className = 'ASCIIWorld', module = 'Generated from ASCII World' } = options;
    const lines = asciiContent.split('\n');

    // Escape each line for Python string
    const rows = lines.map(line => {
        const escaped = line
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
        return `        "${escaped}",`;
    }).join('\n');

    return `#!/usr/bin/env python3
"""
${module}
"""

from dataclasses import dataclass
from typing import List


@dataclass
class ${className}:
    """ASCII World substrate - 80x24 cell grid."""

    cells: List[str] = None

    def __post_init__(self):
        if self.cells is None:
            self.cells = [
${rows}
            ]

    def render(self) -> str:
        """Render the ASCII grid as a string."""
        return "\\n".join(self.cells)

    def show(self) -> None:
        """Print the ASCII grid to stdout."""
        print(self.render())

    def cell_at(self, col: int, row: int) -> str:
        """Get character at position (col, row)."""
        if 0 <= row < len(self.cells) and 0 <= col < len(self.cells[row]):
            return self.cells[row][col]
        return " "

    def set_cell(self, col: int, row: int, char: str) -> None:
        """Set character at position (col, row)."""
        if 0 <= row < len(self.cells):
            line = self.cells[row]
            if 0 <= col < len(line):
                self.cells[row] = line[:col] + char + line[col + 1:]

    def width(self) -> int:
        """Get grid width."""
        return max(len(line) for line in self.cells) if self.cells else 0

    def height(self) -> int:
        """Get grid height."""
        return len(self.cells)


if __name__ == "__main__":
    world = ${className}()
    world.show()
`;
}

/**
 * Render ASCII content to a minimal Python script (just the data).
 * @param {string} asciiContent - The ASCII substrate
 * @returns {string} Minimal Python code
 */
export function renderToPythonMinimal(asciiContent) {
    const lines = asciiContent.split('\n');
    const rows = lines.map(line => {
        const escaped = line
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
        return `    "${escaped}",`;
    }).join('\n');

    return `# ASCII World
GRID = [
${rows}
]

print("\\n".join(GRID))
`;
}

export default renderToPython;
