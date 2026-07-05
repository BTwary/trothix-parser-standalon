export const evaluateLeaseRisk = (extractedData, userContext, ruleThresholds) => {
  const flags = [];

  // 1. Late Fee Reasonableness
  if (extractedData.lateFeePercentage && extractedData.lateFeePercentage > ruleThresholds.leaseMaxLateFeePercent) {
    flags.push({ severity: 'HIGH', clause: 'Late Fee', message: `Late fee of ${extractedData.lateFeePercentage}% exceeds the standard ${ruleThresholds.leaseMaxLateFeePercent}%.` });
  }

  // 2. Security Deposit Limits
  if (extractedData.securityDepositMonths && extractedData.securityDepositMonths > ruleThresholds.leaseMaxDepositMonths) {
    flags.push({ severity: 'HIGH', clause: 'Security Deposit', message: `Deposit of ${extractedData.securityDepositMonths} months rent is unusually high (standard is 1-${ruleThresholds.leaseMaxDepositMonths}).` });
  }

  // 3. Notice of Entry
  if (extractedData.landlordNoticeHours !== null && extractedData.landlordNoticeHours < 24) {
    flags.push({ severity: 'MEDIUM', clause: 'Landlord Entry', message: `Allows landlord entry with less than 24 hours notice (${extractedData.landlordNoticeHours} hours). Check local tenant laws.` });
  }

  // 4. Renewal / Rent Escalation
  if (extractedData.autoRenewalFlag && !extractedData.rentCapPercentage) {
    flags.push({ severity: 'MEDIUM', clause: 'Renewal', message: 'Automatically renews without a defined cap on rent increases.' });
  }

  return flags;
};
