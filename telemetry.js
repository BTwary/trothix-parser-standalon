// Telemetry is opt-in only. It NEVER hashes or sends actual document text.
// It only sends structural metadata to help improve the regex engine.
export function logMiss(docType, failedField) {
  // In production, this would `fetch` to your backend analytics endpoint
  console.log(`[Telemetry] Local Parsing Miss - DocType: ${docType}, Field: ${failedField}`);
  
  // Example fetch:
  // fetch('https://trothix.com/api/telemetry', {
  //   method: 'POST',
  //   body: JSON.stringify({ event: 'regex_miss', docType, failedField })
  // }).catch(() => {});
}
