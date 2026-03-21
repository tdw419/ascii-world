# Design: Webhook Notifications

## Alert Rule with Webhook

```json
{
  "name": "high_cpu",
  "cell": "cpu",
  "operator": ">",
  "threshold": 0.8,
  "webhook": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
  "message": "CPU above 80%"
}
```

## Webhook Payload

POST request with JSON body:

```json
{
  "rule": "high_cpu",
  "cell": "cpu",
  "value": 0.85,
  "threshold": 0.8,
  "operator": ">",
  "severity": "critical",
  "message": "CPU above 80%",
  "timestamp": 1711050000000
}
```

## Implementation

Add to AlertEngine.notify():

```javascript
if (rule.webhook) {
    fetch(rule.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert)
    }).catch(err => console.error('Webhook failed:', err));
}
```

## Supported Services

- Slack (incoming webhooks)
- Discord (webhooks)
- PagerDuty (Events API)
- Custom endpoints
