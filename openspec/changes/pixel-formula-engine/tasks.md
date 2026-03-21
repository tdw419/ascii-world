# Tasks: Pixel Formula Engine

## 1. Fix Documentation
- [ ] 1.1 Update docs/how-pixel-ascii-world-works.md to show correct test count (16, not 27)
- [ ] 1.2 Commit documentation fix

## 2. Create PixelFormulaEngine Module
- [ ] 2.1 Create sync/pixel-formula-engine.js with class skeleton
- [ ] 2.2 Implement constructor(width, height) with PixelBuffer and GlyphAtlas
- [ ] 2.3 Implement setCells(cells) method
- [ ] 2.4 Implement resolveValue(cellValue) helper
- [ ] 2.5 Implement BAR(col, row, cellValue, widthCells) formula
- [ ] 2.6 Implement TEXT(col, row, cellValue) formula
- [ ] 2.7 Implement STATUS(col, row, cellValue, ...thresholds) formula
- [ ] 2.8 Implement BOX(col, row, widthCells, heightCells) formula
- [ ] 2.9 Implement SPARKLINE(col, row, cellValue, widthCells) formula
- [ ] 2.10 Implement clear() and toPNG() methods
- [ ] 2.11 Implement renderTemplate(template) method

## 3. Create Tests
- [ ] 3.1 Create tests/pixel-formula-engine.test.js with imports
- [ ] 3.2 Test: creates buffer with correct dimensions
- [ ] 3.3 Test: clear fills buffer with dark color
- [ ] 3.4 Test: setCells stores cell values
- [ ] 3.5 Test: resolveValue returns literal values
- [ ] 3.6 Test: resolveValue looks up cell references
- [ ] 3.7 Test: BAR draws progress bar
- [ ] 3.8 Test: TEXT draws text at cell coordinates
- [ ] 3.9 Test: STATUS draws status indicator
- [ ] 3.10 Test: BOX draws a box outline
- [ ] 3.11 Test: SPARKLINE draws sparkline from history
- [ ] 3.12 Test: renderTemplate evaluates a pixel template
- [ ] 3.13 Test: toPNG produces valid PNG buffer
- [ ] 3.14 Run tests and verify 11 pass

## 4. Update Documentation
- [ ] 4.1 Update docs/how-pixel-ascii-world-works.md to show Phase 2 complete
- [ ] 4.2 Commit final documentation

## 5. Final Verification
- [ ] 5.1 Run all tests: node --test tests/pixel-*.test.js
- [ ] 5.2 Verify 27+ tests pass
- [ ] 5.3 Check git status is clean
