# Proposal: Webhook Notifications

## Summary
Add webhook support to alerts so notifications can be sent to external services (Slack, Discord, PagerDuty, custom endpoints).

## Problem
- Alerts only broadcast via WebSocket
- No integration with external notification systems
- Can't send alerts to Slack/Discord/etc.

## Solution
When alert triggers, POST to configured webhook URL with alert payload.

## Timeline
- Task 1: Add webhook notifier to AlertEngine (10 min)
- Task 2: Test with public webhook (5 min)
- Task 3: Documentation (5 min)

**Total: ~20 minutes**
