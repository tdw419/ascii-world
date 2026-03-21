# Design: More Formula Functions

## RECT(col, row, widthCells, heightCells, fillColor)
Filled rectangle at cell position.

```javascript
RECT(col, row, w, h, 'barFill')  // Use named color
RECT(col, row, w, h, [255,0,0])  // Use RGB array
```

## LINE(col, row, length, direction, color)
Horizontal or vertical line.

```javascript
LINE(col, row, 40, 'h', 'border')  // Horizontal
LINE(col, row, 5, 'v', 'border')   // Vertical
```

## CIRCLE(col, row, radius, color, filled)
Circle at center position.

```javascript
CIRCLE(40, 12, 5, 'active', true)   // Filled
CIRCLE(40, 12, 5, 'border', false)  // Outline
```

## GAUGE(col, row, value, radius, color)
Circular gauge showing percentage.

```javascript
GAUGE(40, 12, 0.75, 8, 'active')  // 75% filled arc
```

## NUMBER(col, row, cellValue, format)
Formatted number display.

```javascript
NUMBER(0, 0, 'cpu', '0%')      // "75%"
NUMBER(0, 0, 'mem', '0.0 GB')  // "28.1 GB"
```

## TIME(col, row, format)
Current time display.

```javascript
TIME(70, 0, 'HH:mm')     // "14:05"
TIME(70, 0, 'HH:mm:ss')  // "14:05:32"
```

## Color Resolution

Colors can be:
- Named: `'barFill'`, `'active'`, `'border'`, etc.
- RGB array: `[255, 0, 0]`
- Hex number: `0xff0000`
