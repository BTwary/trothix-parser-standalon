export function parseNDA(text, definitions) {
  const extracted = {
    termYears: null,
    termYearsMissingButHandled: false,
    confidentialityScope: '',
    jurisdiction: null,
    counterpartyState: null, // Note: Robust extraction of counterparty state requires AI or strict templating. 
    isUnilateral: false,
    mentionsTradeSecrets: false,
  };

  // 1. Duration / Term parsing
  const termRegex = /period of (\d+|one|two|three|four|five|ten) years?/i;
  const matchTerm = text.match(termRegex);
  if (matchTerm) {
    let num = matchTerm[1].toLowerCase();
    const map = { one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10 };
    extracted.termYears = map[num] || parseInt(num, 10);
  } else if (/perpetual|indefinite|survive termination/i.test(text)) {
    extracted.termYearsMissingButHandled = true;
  }

  // 2. Scope & Trade Secrets
  const scopeRegex = /Confidential Information(?: shall)? means (.*?)(?=\.|$)/i;
  const matchScope = text.match(scopeRegex);
  if (matchScope) {
    extracted.confidentialityScope = matchScope[1];
  } else if (/confidential information/i.test(text)) {
    extracted.confidentialityScope = 'Found mentions of confidential information.';
  }

  extracted.mentionsTradeSecrets = /trade secret/i.test(text);

  // 3. Jurisdiction
  const jurisdictionRegex = /(?:governed by the laws of|jurisdiction of) (the State of )?([A-Z][a-zA-Z\s]+)/i;
  const matchJur = text.match(jurisdictionRegex);
  if (matchJur && matchJur[2]) {
    extracted.jurisdiction = matchJur[2].trim();
  }

  // 4. Unilateral vs Mutual
  // Instead of requiring them adjacent, we check if both exist anywhere in the text independently
  const hasMutual = /mutual(?: non-disclosure| confidentiality)/i.test(text);
  const hasDisclosing = /disclosing party/i.test(text);
  const hasReceiving = /receiving party/i.test(text);
  
  if (hasMutual) {
    extracted.isUnilateral = false;
  } else if (hasDisclosing && hasReceiving) {
    // If it clearly defines both roles separately but lacks "mutual"
    extracted.isUnilateral = true;
  }

  return extracted;
}
