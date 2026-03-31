import { PxOSServer } from '../../server.js';

async function test() {
  console.log("Starting Bridge Test...");
  const server = new PxOSServer(3840);
  
  const spec = `
  H: Test Bridge Optimization
  T: sync/pixel-renderer.js
  M: render_time < 5ms
  B: 10ms
  `;

  console.log("Mocking handleRunExperiment request...");
  
  // Create a minimal mock request body reader
  const mockReadBody = async (req) => {
      return JSON.stringify({ spec, x: 5, y: 5 });
  };
  
  // Override readBody for this test instance
  server.readBody = mockReadBody;

  const res = {
    writeHead: (status, headers) => console.log(`Response Status: ${status}`),
    end: (data) => {
      const result = JSON.parse(data);
      console.log("Result Status:", result.status);
      console.log("Metric Value:", result.metricValue);
      console.log("Template Size:", server.template.length);
      
      if (server.template.length > 0) {
        console.log("SUCCESS: Template updated with experiment results.");
        console.log("Template Sample:", JSON.stringify(server.template[0]));
      } else {
        console.log("FAILURE: Template not updated.");
      }
      process.exit(0);
    },
    setHeader: (name, value) => {}
  };

  try {
    await server.handleRunExperiment({}, res);
  } catch (err) {
    console.error("Execution Error:", err);
    process.exit(1);
  }
}

test().catch(err => {
  console.error("Initialization Error:", err);
  process.exit(1);
});
