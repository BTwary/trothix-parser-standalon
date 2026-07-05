import { processDocument } from './core/router.js';

// Baked-in fallback config if network fails
const DEFAULT_RULES = {
  schemaVersion: "1.0",
  ndaMaxTerm: 3,
  neutralStates: ["Delaware", "New York", "California"],
  leaseMaxLateFeePercent: 5,
  leaseMaxDepositMonths: 2
};

let activeRules = DEFAULT_RULES;

// Attempt to fetch dynamic config on load
async function loadConfig() {
  try {
    const res = await fetch('./rules.json');
    if (res.ok) {
      const data = await res.json();
      if (data.schemaVersion === "1.0") {
        activeRules = data;
        console.log("[Trothix Engine] Loaded dynamic rules.json");
      } else {
        console.warn("[Trothix Engine] Schema mismatch, falling back to defaults.");
      }
    }
  } catch (err) {
    console.warn("[Trothix Engine] Network offline or rules.json missing, using bundled fallback.");
  }
}

// Initialize config fetch
loadConfig();

// Listen for messages from the main thread
self.addEventListener('message', async (e) => {
  const { documentText, documentType, userContext, jobId, consentTelemetry } = e.data;
  
  if (!documentText) return;

  try {
    const result = await processDocument(documentText, documentType, userContext, activeRules, consentTelemetry);
    self.postMessage({ jobId, status: 'success', result });
  } catch (error) {
    self.postMessage({ jobId, status: 'error', error: error.message });
  }
});
