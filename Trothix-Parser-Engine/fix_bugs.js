const fs = require('fs');
const path = require('path');

const dir = __dirname;

// 1. leaseParser.js rent guard
const leaseParserPath = path.join(dir, 'parsers', 'leaseParser.js');
let leaseParser = fs.readFileSync(leaseParserPath, 'utf8');
leaseParser = leaseParser.replace(
  /const rentRegex = \/rent\.{0,40}\?\\\$\(\[0-9,\]\+\)\(\?:\\\.\[0-9\]\{2\}\)\?\/i;\s*const matchRent = text\.match\(rentRegex\);\s*if \(matchRent\) \{\s*extracted\.monthlyRent = parseFloat\(matchRent\[1\]\.replace\(\/,\/g, ''\)\);\s*\}/s,
  `const rentMatches = [...text.matchAll(/rent.{0,60}?\\$([0-9,]+)(?:\\.[0-9]{2})?/ig)];
  for (const m of rentMatches) {
    const snippet = text.substring(Math.max(0, m.index - 20), m.index + m[0].length);
    if (!/deposit/i.test(snippet)) {
      extracted.monthlyRent = parseFloat(m[1].replace(/,/g, ''));
      break;
    }
  }`
);
fs.writeFileSync(leaseParserPath, leaseParser);

// 2. Normalize severity
const rulesFiles = ['ndaRules.js', 'leaseRules.js'];
rulesFiles.forEach(file => {
  const p = path.join(dir, 'rules', file);
  let c = fs.readFileSync(p, 'utf8');
  c = c.replace(/'YELLOW'/g, "'MEDIUM'");
  c = c.replace(/'RED'/g, "'HIGH'");
  c = c.replace(/'INFO'/g, "'LOW'");
  fs.writeFileSync(p, c);
});

// 3, 4, 5. index.html issues
const indexHtmlPath = path.join(dir, 'index.html');
let indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// f.issue -> f.message in topPoints
indexHtml = indexHtml.replace(/f => f\.issue/g, 'f => f.message');

// documentType: null -> window.__trothixDocument
indexHtml = indexHtml.replace(/documentType:\s*null,/, 'documentType: window.__trothixDocument ? window.__trothixDocument.documentType : null,');

// Mock context -> Real DOM lookup
indexHtml = indexHtml.replace(
  /userContext:\s*\{\s*homeState:\s*"New York",\s*role:\s*"Tenant"\s*\},.*?\/\/ Mock context\s*jobId:\s*Date\.now\(\),\s*consentTelemetry:\s*false/s,
  `userContext: { 
      homeState: document.getElementById('userState') ? document.getElementById('userState').value : "New York", 
      role: document.getElementById('userRole') ? document.getElementById('userRole').value : "Tenant" 
    },
    jobId: Date.now(),
    consentTelemetry: document.getElementById('telemetryConsent') ? document.getElementById('telemetryConsent').checked : false`
);

// Inject simple UI next to desk (line ~283 where #desk is, or inside inputState)
const uiSnippet = `
<div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap; background:var(--paper); padding:10px; border-radius:8px; border:1px solid var(--rule);">
  <select id="userState" style="padding: 5px; border-radius: 4px; border:1px solid var(--rule);"><option value="New York">New York</option><option value="California">California</option><option value="Texas">Texas</option></select>
  <select id="userRole" style="padding: 5px; border-radius: 4px; border:1px solid var(--rule);"><option value="Tenant">Tenant</option><option value="Landlord">Landlord</option><option value="Employee">Employee</option><option value="Employer">Employer</option><option value="Freelancer">Freelancer</option><option value="Disclosing Party">Disclosing Party</option><option value="Receiving Party">Receiving Party</option></select>
  <label style="font-size: 12px; display: flex; align-items: center; color:var(--ink);"><input type="checkbox" id="telemetryConsent" style="margin-right:5px;"> Allow AI Fallback / Telemetry</label>
</div>
`;

if (!indexHtml.includes('id="userState"')) {
  // Insert before docInput
  indexHtml = indexHtml.replace(/<textarea id="docInput"/, uiSnippet + '\n<textarea id="docInput"');
}

fs.writeFileSync(indexHtmlPath, indexHtml);

console.log("Fixed 5 bugs successfully.");
