export function parseUniversal(text, definitions) {
  const extracted = {
    hasBindingArbitration: false,
    hasJuryWaiver: false,
    hasClassActionWaiver: false,
    hasUnilateralIndemnification: false,
    hasLiquidatedDamages: false,
    hasLiabilityCap: false,
    hasPerpetualLicense: false,
    jurisdiction: null,
    isFullyLocal: false
  };

  // 1. Dispute Resolution
  if (/binding arbitration|submit to arbitration/i.test(text)) extracted.hasBindingArbitration = true;
  if (/waive(?:s)?.*?jury trial|waiver of jury/i.test(text)) extracted.hasJuryWaiver = true;
  if (/class action waiver|waive.*?class action/i.test(text)) extracted.hasClassActionWaiver = true;

  // 2. Indemnification (Looking for one-sided terms without "mutual")
  const hasIndemnify = /indemnify and hold harmless|agree to indemnify/i.test(text);
  const hasMutual = /mutual indemnification|mutually indemnify/i.test(text);
  if (hasIndemnify && !hasMutual) {
    extracted.hasUnilateralIndemnification = true;
  }

  // 3. Damages & Liability
  if (/liquidated damages/i.test(text)) extracted.hasLiquidatedDamages = true;
  if (/limitation of liability|liability shall not exceed/i.test(text)) extracted.hasLiabilityCap = true;

  // 4. IP / Rights
  if (/perpetual, irrevocable.*?license|irrevocable, perpetual/i.test(text)) extracted.hasPerpetualLicense = true;

  // 5. Jurisdiction
  const jurisdictionRegex = /(?:governed by the laws of|jurisdiction of) (the State of )?([A-Z][a-zA-Z\s]+)/i;
  const matchJur = text.match(jurisdictionRegex);
  if (matchJur && matchJur[2]) {
    extracted.jurisdiction = matchJur[2].trim();
  }

  // Determine if we found enough generic signals to consider this a successful local parse
  const foundGenericFlags = extracted.hasBindingArbitration || extracted.hasUnilateralIndemnification || 
                            extracted.hasLiquidatedDamages || extracted.hasLiabilityCap || extracted.hasPerpetualLicense;

  if (foundGenericFlags || extracted.jurisdiction) {
    extracted.isFullyLocal = true;
  }

  return extracted;
}
