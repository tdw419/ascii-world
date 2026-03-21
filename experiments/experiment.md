# ASCII World Autonomous Loop (Experiment Protocol)

This document defines the automated experimentation loop for ASCII World, inspired by the `autoresearch` pattern.

## Setup & Goals

The goal of this loop is to autonomously discover, test, and validate new ASCII UI patterns, edge cases in the parser, or integration mappings.

To begin an experiment:
1. **Define the Domain**: E.g., "UI Layout Generation", "Parser Edge Cases", "Docker Integration".
2. **Set the Target**: What metric determines success? (e.g., `parsed_elements == intended_elements`, `visual_coherence_score`).
3. **Initialize Tracking**: Create a `results.tsv` in the `experiments/` directory to log findings.

## The Experiment Loop

This loop runs continuously until interrupted.

**LOOP FOREVER:**

1. **State Analysis**: Review the current `compliance.md` and previously successful patterns.
2. **Hypothesis Generation**: Propose a new ASCII layout, element combination, or action binding.
3. **Implementation**:
    - Write the proposed ASCII to a temporary file in `data/`.
    - Use `sync/ai-writer.js` (or similar utility) to embed the verification hash.
4. **Execution & Validation**:
    - Let the sync server parse the file and return the `parse_report`.
    - Compare the `parse_report` against the hypothesis' intended elements.
5. **Metric Evaluation**:
    - Did the parser see exactly what was intended? (Score: 1 for perfect match, 0 for failure).
    - If testing actions: Did the action trigger the correct state mutation in the ASCII?
6. **Logging**:
    - Record the result in `experiments/results.tsv` (Commit/Hash, Score, Status: keep/discard, Description).
7. **Iteration**:
    - **Success (`keep`)**: Save the pattern as a template in `src/ascii/templates/` or update `compliance.md`.
    - **Failure (`discard`)**: Analyze the parse report differences, adjust the ASCII layout, and retry.

## Example: UI Generation (Domain)

*   **Hypothesis**: The parser can handle a 3-column table inside a card.
*   **Action**: Write ASCII representing this structure.
*   **Validation**: Check if `parse_report.cards[0].hasTable` is true and columns == 3.

## Output Format (results.tsv)

```tsv
hash        score   status  description
a1b2c3d     1.0     keep    Baseline 2-column table
b2c3d4e     0.0     discard Table inside card failed to parse columns
c3d4e5f     1.0     keep    Fixed table spacing, successfully parsed inside card
```

## Constraints

*   **Time Budget**: Each iteration should take < 30 seconds (Write -> Parse -> Report).
*   **Modifications**: Do not alter the core parser (`ascii_world_template.html`) during a discovery loop unless the goal is explicitly "Parser Refactoring". The primary target of modification is the `.ascii` files.
*   **Autonomy**: Once started, do not pause for human confirmation on every step. Log continuously.
