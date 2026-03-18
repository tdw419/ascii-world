# Pattern Recognition Validation Tests

This directory contains validation tests that prove the Pattern Recognition Renderer works correctly.

## Test Categories

### 1. LLM Cross-Validation (`llm-cross-validate.test.ts`)
Compares parser output against expected patterns. Validates:
- Button detection accuracy
- Status indicator mapping
- Container boundary detection
- Table structure extraction

### 2. Real Manager Integration (`manager-integration.test.ts`)
Tests pattern detection against real ASCII from manager server. Validates:
- Patterns work with real templates
- Navigation button consistency
- Cross-view pattern detection

### 3. Round-Trip Fidelity (`round-trip.test.ts`)
Ensures pattern detection maintains accuracy. Validates:
- Exact pattern counts
- No spurious detections
- Consistent repeated parsing

## Running Tests

```bash
# Run all validation tests
bun test tests/validation/

# Run specific test file
bun test tests/validation/llm-cross-validate.test.ts

# Run validation runner for summary
bun run tests/validation/run-validation.ts
```

## Adding New Test Templates

1. Add template to `fixtures/sample-templates.ts`
2. Define expected patterns
3. Run tests to verify detection works

## Validation Criteria

A pattern detection is valid when:
1. All expected patterns are detected
2. No unexpected patterns are detected
3. Pattern properties are accurate
4. Detection is consistent across runs

## Files

| File | Purpose |
|------|---------|
| `run-validation.ts` | Standalone validation runner with summary output |
| `llm-cross-validate.test.ts` | Cross-validation tests comparing parser to expected patterns |
| `manager-integration.test.ts` | Integration tests with real manager ASCII output |
| `round-trip.test.ts` | Fidelity tests for consistent pattern detection |
| `fixtures/` | Sample templates and test data |
| `llm-analysis-prompt.md` | Prompt template for independent LLM analysis |

## Output Format

The validation runner (`run-validation.ts`) produces:

```
======================================================================
PATTERN RECOGNITION VALIDATION REPORT
======================================================================
Timestamp: 2026-03-18T...

Validating: Projects Template
--------------------------------------------------
  [PASS] Match Score: 95%
  Patterns detected: 25
  Buttons: A, B, C, D, E, X, ...
  Statuses: running, stopped, warning
  Containers: 2

======================================================================
SUMMARY
======================================================================

Validation Results: 3 passed, 0 failed, 3 total

Pattern Statistics:
  Total patterns detected: 75
  By type:
    - button: 35
    - status-indicator: 12
    - container: 5

======================================================================
ALL VALIDATIONS PASSED
======================================================================
```

## Exit Codes

- `0` - All validations passed
- `1` - One or more validations failed

This allows the runner to be used in CI pipelines.
