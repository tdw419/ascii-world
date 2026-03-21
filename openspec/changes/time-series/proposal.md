# Proposal: Time-Series Storage

## Summary
Add time-series storage to track historical cell values for charting and trend analysis.

## Problem
- No history of cell values over time
- Can't show trends or historical charts
- Alerts only show current state, not patterns

## Solution
Ring buffer storage per cell:
- Store last N values with timestamps
- API to query historical data
- Support for sparklines, charts with history

## Impact
- Historical trend visualization
- Better alerting with trend detection
- Data analysis capabilities

## Timeline
- Task 1: TimeSeriesStore (15 min)
- Task 2: Server integration (10 min)
- Task 3: Tests (10 min)

**Total: ~35 minutes**
