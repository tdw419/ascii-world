# LLM ASCII Pattern Analysis Prompt

Use this prompt to have an LLM independently analyze ASCII templates and compare with our parser's output.

## Prompt Template

```
You are analyzing an ASCII user interface. Please identify all UI elements you see.

**ASCII Template:**
```
{{ASCII_CONTENT}}
```

**Analysis Task:**
For each UI element you detect, provide:
1. **Type**: button, container, status-indicator, or table
2. **Description**: A brief description of what you see
3. **Location**: Approximate line number or position

**Pattern Reference:**
- **Buttons**: Pattern `[X] label` where X is a single uppercase letter or number
- **Containers**: Box drawing characters like `╔═╗║╚╝┌─┐│└┘`
- **Status Indicators**: Unicode symbols `● ○ ◐ ◑ ◉`
- **Tables**: Pipe-separated columns `│ Col1 │ Col2 │`

**Expected Output Format:**
```
ELEMENTS FOUND:
- [Type: button] [A] Tasks - navigation button
- [Type: button] [B] Settings - navigation button
- [Type: container] Main dashboard box (lines 1-10)
- [Type: status-indicator] ● running (line 5)
```
```

## Usage

1. Replace `{{ASCII_CONTENT}}` with the actual ASCII template
2. Send prompt to LLM
3. Parse LLM response for element list
4. Compare with `parseAscii()` output

## Example Comparison

**LLM Analysis:**
```
ELEMENTS FOUND:
- [Type: button] [A] Projects
- [Type: button] [X] Quit
- [Type: status-indicator] ● running
```

**Parser Output:**
```json
{
  "patterns": [
    { "type": "button", "label": "A", "text": "Projects" },
    { "type": "button", "label": "X", "text": "Quit" },
    { "type": "status-indicator", "status": "running", "symbol": "●" }
  ]
}
```

**Match Score:** 100% (3/3 patterns match)
