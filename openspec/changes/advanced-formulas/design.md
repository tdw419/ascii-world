# Design: Advanced Formulas

## CHART(col, row, cellArray, width, height, color)
Bar chart from array of values.

```javascript
CHART(0, 2, 'history', 40, 3, 'barFill')
```

## DONUT(col, row, cellValue, radius, color, bgColor)
Donut/ring chart showing percentage.

```javascript
DONUT(10, 5, 'cpu', 4, 'active', 'barEmpty')
```

## PROGRESS(col, row, cellValue, size, color)
Circular progress indicator.

```javascript
PROGRESS(70, 3, 'cpu', 3, 'active')
```

## BADGE(col, row, text, bgColor, textColor)
Status badge with background.

```javascript
BADGE(0, 0, 'ACTIVE', 'active', 'white')
```

## COND(col, row, cellValue, threshold, aboveColor, belowColor)
Conditional cell coloring.

```javascript
COND(0, 2, 'cpu', 0.8, 'critical', 'active')
```

## HISTORY(col, row, cellValue, prevValue, format)
Show value with trend arrow (↑↓→).

```javascript
HISTORY(0, 2, 'cpu', 'cpu_prev', '0%')
// Output: "75% ↑" or "75% ↓" or "75% →"
```

## GRID(col, row, cellArray, cols, color)
Display array as grid of values.

```javascript
GRID(0, 5, 'metrics', 4, 'text')
// Shows 4 columns of values
```
