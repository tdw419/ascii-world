// pxOS-AutoResearch Bridge
// Publishes experiment results to pxOS cells for visualization

const API_BASE = 'http://localhost:3001';

async function publishExperiment(result) {
  // Update cells with experiment data
  await fetch(`${API_BASE}/api/cells`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exp_metric: result.metric_value,
      exp_status: result.status, // KEEP/REVERT
      exp_commit: result.commit_id,
      exp_hypothesis: result.hypothesis.slice(0, 50)
    })
  });
  
  // Add to time series for sparkline
  await fetch(`${API_BASE}/api/timeseries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metric: 'experiment_metric',
      value: result.metric_value,
      timestamp: new Date().toISOString()
    })
  });
}

function createExperimentDashboard() {
  // pxOS formula template for experiment viz
  return `
    =BAR(10, 8, 'exp_metric', 30)
    =TEXT(50, 8, 'exp_status')
    =SPARKLINE(10, 12, 'experiment_metric', 50)
    =TEXT(10, 16, 'exp_hypothesis')
  `;
}

module.exports = { publishExperiment, createExperimentDashboard };
