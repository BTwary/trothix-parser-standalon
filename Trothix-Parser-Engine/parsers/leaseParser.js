export function parseLease(text, definitions) {
  const extracted = {
    monthlyRent: null,
    securityDepositMonths: null,
    lateFeePercentage: null,
    landlordNoticeHours: null,
    autoRenewalFlag: false,
    rentCapPercentage: null
  };

  // 1. Rent Amount (broader match: "Monthly Rent: $1500" or "Rent shall be $1500")
  const rentRegex = /rent.{0,40}?\$([0-9,]+)(?:\.[0-9]{2})?/i;
  const matchRent = text.match(rentRegex);
  if (matchRent) {
    extracted.monthlyRent = parseFloat(matchRent[1].replace(/,/g, ''));
  }

  // 2. Security Deposit
  const depositRegex = /security deposit.*?equal to (\d+|one|two|three) months? rent/i;
  const matchDeposit = text.match(depositRegex);
  if (matchDeposit) {
    let num = matchDeposit[1].toLowerCase();
    const map = { one: 1, two: 2, three: 3 };
    extracted.securityDepositMonths = map[num] || parseInt(num, 10);
  }

  // 3. Late Fee
  const lateFeeRegex = /late fee.{0,30}?(\d+)%/i;
  const matchLateFee = text.match(lateFeeRegex);
  if (matchLateFee) {
    extracted.lateFeePercentage = parseInt(matchLateFee[1], 10);
  }

  // 4. Notice of Entry
  const noticeRegex = /(\d+|twenty-?four|forty-?eight)\s*(?:hours|hrs).*?notice.*?entry/i;
  const matchNotice = text.match(noticeRegex);
  if (matchNotice) {
    let num = matchNotice[1].toLowerCase().replace('-', '');
    const map = { twentyfour: 24, fortyeight: 48 };
    extracted.landlordNoticeHours = map[num] || parseInt(num, 10);
  }

  // 5. Renewal
  if (/automatically renew/i.test(text)) {
    extracted.autoRenewalFlag = true;
  }
  
  // 6. Rent Cap
  const rentCapRegex = /rent increase shall not exceed (\d+)%/i;
  const matchCap = text.match(rentCapRegex);
  if (matchCap) {
    extracted.rentCapPercentage = parseInt(matchCap[1], 10);
  }

  return extracted;
}
