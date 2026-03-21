# Tasks: Pixel Formula Engine

## 1. Fix Documentation
- [x] 1.1 Update docs/how-pixel-ascii-world-works.md to show correct test count (16, not 27)
- [x] 1.2 Commit documentation fix

## 2. Create PixelFormulaEngine Module
- [x] 2.1 Create sync/pixel-formula-engine.js with class skeleton
- [x] 2.2 Implement constructor(width, height) with PixelBuffer and GlyphAtlas
- [x] 2.3 Implement setCells(cells) method
- [x] 2.4 Implement resolveValue(cellValue) helper
- [x] 2.5 Implement BAR(col, row, cellValue, widthCells) formula
- [x] 2.6 Implement TEXT(col, row, cellValue) formula
- [x] 2.7 Implement STATUS(col, row, cellValue, ...thresholds) formula
- [x] 2.8 Implement BOX(col, row, widthCells, heightCells) formula
- [x] 2.9 Implement SPARKLINE(col, row, cellValue, widthCells) formula
- [x] 2.10 Implement clear() and toPNG() methods
- [x] 2.11 Implement renderTemplate(template) method

## 3. Create Tests
- [x] 3.1 Create tests/pixel-formula-engine.test.js with imports
- [x] 3.2 Test: creates buffer with correct dimensions
- [x] 3.3 Test: clear fills buffer with dark color
- [x] 3.4 Test: setCells stores cell values
- [x] 3.5 Test: resolveValue returns literal values
- [x] 3.6 Test: resolveValue looks up cell references
- [x] 3.7 Test: BAR draws progress bar
- [x] 3.8 Test: TEXT draws text at cell coordinates
- [x] 3.9 Test: STATUS draws status indicator
- [x] 3.10 Test: BOX draws a box outline
- [x] 3.11 Test: SPARKLINE draws sparkline from history
- [x] 3.12 Test: renderTemplate evaluates a pixel template
- [x] 3.13 Test: toPNG produces valid PNG buffer
- [x] 3.14 Run tests and verify 12 pass

## 4. Update Documentation
- [x] 4.1 Update docs/how-pixel-ascii-world-works.md to show Phase 2 complete
- [x] 4.2 Commit final documentation

## 5. Final Verification
- [x] 5.1 Run all tests: node --test tests/pixel-*.test.js
- [x] 5.2 Verify 28 tests pass
- [x] 5.3 Check git status is clean
