export function parseBase(text, definitions) {
  const extracted = {};

  // Simple scan for universal risk markers
  extracted.hasIndemnification = /indemnify|indemnification/i.test(text);
  extracted.hasArbitration = /arbitration|arbitrate/i.test(text);
  extracted.hasLimitationOfLiability = /limitation of liability|cap on liability/i.test(text);
  
  // Extract simple dates or dollar amounts just to see if we can
  const moneyMatch = text.match(/\$[0-9,]+(\.[0-9]{2})?/);
  if (moneyMatch) {
    extracted.notableMoneyAmount = moneyMatch[0];
  }

  return extracted;
}
