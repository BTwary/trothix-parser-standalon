export function evaluateUniversalRisk(data, userContext, rules) {
  const flags = [];

  if (data.hasBindingArbitration) {
    flags.push({
      severity: 'MEDIUM',
      clause: 'Binding Arbitration',
      message: 'You are giving up your right to sue in court if a dispute arises.'
    });
  }

  if (data.hasJuryWaiver || data.hasClassActionWaiver) {
    flags.push({
      severity: 'MEDIUM',
      clause: 'Jury / Class Action Waiver',
      message: 'You are waiving your right to a trial by jury or to join a class action lawsuit.'
    });
  }

  if (data.hasUnilateralIndemnification) {
    flags.push({
      severity: 'HIGH',
      clause: 'One-Sided Indemnification',
      message: 'You may be forced to pay for the other party’s legal costs and damages if they are sued because of you.'
    });
  }

  if (data.hasPerpetualLicense) {
    flags.push({
      severity: 'HIGH',
      clause: 'Perpetual License',
      message: 'You are giving away permanent, irrevocable rights to your content or intellectual property.'
    });
  }

  if (data.hasLiabilityCap) {
    flags.push({
      severity: 'MEDIUM',
      clause: 'Liability Cap',
      message: 'The other party has strictly limited how much money you can recover if they breach the contract.'
    });
  }

  if (data.jurisdiction && userContext && userContext.homeState) {
    if (data.jurisdiction.toLowerCase() !== userContext.homeState.toLowerCase()) {
      flags.push({
        severity: 'MEDIUM',
        clause: `Governing Law: ${data.jurisdiction}`,
        message: `Disputes must be resolved under the laws of ${data.jurisdiction}, which is outside your home state.`
      });
    }
  }

  return flags;
}
