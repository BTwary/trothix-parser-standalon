export const evaluateNDARisk = (extractedData, userContext, ruleThresholds) => {
  const flags = [];
  
  // 1. Duration Risk (Strict Trade Secret logic)
  const isPerpetual = !extractedData.termYears && extractedData.termYearsMissingButHandled;
  const hasTradeSecretClause = extractedData.mentionsTradeSecrets;
  
  if (!extractedData.termYears && !extractedData.termYearsMissingButHandled && !hasTradeSecretClause) {
    flags.push({ severity: 'MEDIUM', clause: 'Term', message: 'No expiration date found. Standard confidential info should have a fixed term (unlike Trade Secrets).' });
  } else if (isPerpetual && !hasTradeSecretClause) {
    flags.push({ severity: 'MEDIUM', clause: 'Term', message: 'Term is perpetual but no trade secret exception was found.' });
  } else if (extractedData.termYears > ruleThresholds.ndaMaxTerm && !hasTradeSecretClause) {
    flags.push({ severity: 'MEDIUM', clause: 'Term', message: `Duration exceeds standard ${ruleThresholds.ndaMaxTerm} years for non-trade-secret information.` });
  }

  // 2. Jurisdiction Risk (Only flag 3rd party venues)
  if (extractedData.jurisdiction && userContext?.homeState) {
     const isMyState = extractedData.jurisdiction.toLowerCase() === userContext.homeState.toLowerCase();
     const isOtherPartyState = extractedData.counterpartyState && extractedData.jurisdiction.toLowerCase() === extractedData.counterpartyState.toLowerCase();
     
     if (!isMyState && !isOtherPartyState && !ruleThresholds.neutralStates.map(s=>s.toLowerCase()).includes(extractedData.jurisdiction.toLowerCase())) {
         flags.push({ severity: 'MEDIUM', clause: 'Governing Law', message: `Jurisdiction is ${extractedData.jurisdiction}, which matches neither party's location.` });
     } else if (!isMyState) {
         flags.push({ severity: 'LOW', clause: 'Governing Law', message: `Governing law is ${extractedData.jurisdiction} (Counterparty's state).` });
     }
  }

  // 3. Unilateral Risk Context
  if (extractedData.isUnilateral && userContext?.role === 'Receiving Party') {
     flags.push({ severity: 'LOW', clause: 'Scope', message: 'This is a unilateral NDA where you are the receiving party. Verify you are not required to disclose any of your own confidential information.' });
  }

  return flags;
};
