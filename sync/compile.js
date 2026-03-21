// compile.js - Example usage of AsciiCompiler
import fs from 'fs';
import path from 'path';
import { AsciiParser } from './parser.js';
import { AsciiCompiler } from './compiler.js';

const sampleAscii = `
╔══════════════════════════════════════════════════════════════════════════════╗
║  DASHBOARD                                                    ver:--------   ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  [A] Start All  [B] Stop All  [R] Refresh                                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  ┌──────────────────────────────────────────────────────────────────────────┐║
║  │  Name          Port    Status    Uptime                                 │║
║  ├──────────────────────────────────────────────────────────────────────────┤║
║  │  web-app       3000    ● running  2h 15m                                │║
║  │  api-server    3001    ○ stopped  --                                    │║
║  └──────────────────────────────────────────────────────────────────────────┘║
╚══════════════════════════════════════════════════════════════════════════════╝
`;

console.log("Parsing ASCII input...");
const parser = new AsciiParser();
const ast = parser.parse(sampleAscii);

console.log("\n--- AST (Parse Report) ---");
console.log(JSON.stringify(parser.getReport(), null, 2));

const compiler = new AsciiCompiler(ast);

console.log("\n\n=== GENERATING REACT COMPONENT ===");
console.log(compiler.toReact());

console.log("\n\n=== GENERATING VANILLA JS ===");
console.log(compiler.toVanillaJS());

console.log("\n\n=== GENERATING PYTHON (TEXTUAL) ===");
console.log(compiler.toPythonTextual());
