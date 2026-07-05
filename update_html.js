const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

// The block to replace
const analyzeBlockRegex = /analyzeBtn\.addEventListener\('click', async \(\)=>\{[\s\S]*?\}\);/m;

const newAnalyzeBlock = `
let parserWorker = new Worker('worker.js', { type: 'module' });

analyzeBtn.addEventListener('click', async ()=>{
  const text = docInput.value.trim();
  errorBox.style.display = 'none';
  results.style.display = 'none';
  resetFeedbackUI();

  if(!text){
    errorBox.textContent = "Paste some document text first — there's nothing here to analyze.";
    errorBox.style.display = 'block';
    return;
  }
  if(text.length < 100){
    errorBox.textContent = "That's pretty short for a contract — paste at least a few sentences so there's enough to work with.";
    errorBox.style.display = 'block';
    return;
  }

  analyzeBtn.disabled = true;
  statusText.innerHTML = '<span class="spinner"></span>Processing locally...';

  // Ask worker to process
  parserWorker.postMessage({
    documentText: text,
    documentType: null,
    userContext: { homeState: "New York", role: "Tenant" }, // Mock context
    jobId: Date.now(),
    consentTelemetry: false
  });

  parserWorker.onmessage = (e) => {
    const { status, result, error } = e.data;
    analyzeBtn.disabled = false;
    statusText.textContent = '';

    if (status === 'error') {
      errorBox.textContent = "Engine Error: " + error;
      errorBox.style.display = 'block';
      return;
    }

    if (result.isFullyLocal) {
      // Synthesize a UI-compatible report
      const d = {
        documentType: result.docType === 'NDA' ? 'Non-Disclosure Agreement' : (result.docType === 'LEASE' ? 'Lease Agreement' : 'Document'),
        riskLevel: result.flags.some(f => f.severity === 'HIGH') ? 'high' : (result.flags.some(f => f.severity === 'MEDIUM') ? 'medium' : 'low'),
        riskSummary: result.flags.length > 0 ? "Found some clauses that require your attention." : "Looks relatively standard, but always read carefully.",
        topPoints: result.flags.slice(0, 3).map(f => f.issue),
        summary: "This document was parsed entirely locally on your device. Your data never left your browser.",
        keyTerms: {
          duration: result.extractedData.termYears ? \`\${result.extractedData.termYears} years\` : 'Not specified',
          payment: result.extractedData.monthlyRent ? \`$\${result.extractedData.monthlyRent}/mo\` : 'Not specified',
          termination: result.extractedData.isUnilateral ? 'Unilateral' : 'Mutual',
          penalties: result.extractedData.lateFeePercentage ? \`\${result.extractedData.lateFeePercentage}%\` : 'Not specified'
        },
        redFlags: result.flags.map(f => ({
          severity: f.severity.toLowerCase(),
          clause: f.clause,
          issue: f.message
        }))
      };
      renderResults(d);
    } else {
      // Show AI Consent Mockup
      errorBox.innerHTML = \`
        <div style="color:var(--ink); font-weight:600; margin-bottom:8px;">AI Assistance Required</div>
        <div style="color:var(--ink-soft); margin-bottom:12px;">The local engine couldn't confidently parse all necessary fields. To continue, we need to send a snippet to the AI.</div>
        <div style="background:var(--paper); padding:12px; border:1px solid var(--rule); font-family:monospace; font-size:12px; margin-bottom:12px; max-height:150px; overflow:auto;">
          \${result.aiPayloadRecommendation.map(r => r.rawTextToAnalyze).join('<hr>')}
        </div>
        <button id="mockApproveBtn" class="analyze-btn" style="padding:8px 16px; font-size:12px;">Approve AI Analysis</button>
      \`;
      errorBox.style.display = 'block';
      
      document.getElementById('mockApproveBtn').addEventListener('click', () => {
        errorBox.style.display = 'none';
        statusText.innerHTML = '<span style="color:var(--green)">✓ AI fallback approved (Mocked in Standalone Mode).</span>';
      });
    }
  };
});
`;

content = content.replace(analyzeBlockRegex, newAnalyzeBlock);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated index.html');
