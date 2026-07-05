import { parseDefinitions } from './definitions.js';
import { parseNDA } from '../parsers/ndaParser.js';
import { parseLease } from '../parsers/leaseParser.js';
import { parseUniversal } from '../parsers/universalParser.js';
import { evaluateNDARisk } from '../rules/ndaRules.js';
import { evaluateLeaseRisk } from '../rules/leaseRules.js';
import { evaluateUniversalRisk } from '../rules/universalRules.js';
import { logMiss } from '../telemetry.js';

export async function processDocument(documentText, providedType, userContext, rules, consentTelemetry) {
  // 1. Pre-process text (definitions is currently a stub)
  const normalizedText = documentText.replace(/\r\n/g, '\n');
  const definedTerms = parseDefinitions(normalizedText);
  
  // 2. Identify type if not provided
  const docType = providedType || identifyType(normalizedText);
  
  let extractedData = {};
  let flags = [];
  let requiresAIFallback = false;
  let missingClausesPayload = [];

  // Helper to extract a safe context window for AI
  const getContextSnippet = (keyword) => {
      const idx = normalizedText.toLowerCase().indexOf(keyword);
      if (idx === -1) return normalizedText.substring(0, 2000); // Send first 2k chars if keyword missing
      const start = Math.max(0, idx - 1000);
      const end = Math.min(normalizedText.length, idx + 1000);
      return normalizedText.substring(start, end);
  };

  // 3. Route to specific parsers
  if (docType === 'NDA') {
    extractedData = parseNDA(normalizedText, definedTerms);
    
    // Check if required fields are missing
    if (!extractedData.confidentialityScope || (!extractedData.termYears && !extractedData.termYearsMissingButHandled)) {
      requiresAIFallback = true;
      missingClausesPayload.push({
        type: 'missing_term',
        context: 'Could not confidently identify the duration or scope of confidentiality.',
        rawTextToAnalyze: getContextSnippet('term') // Added actual excerpt for AI
      });
      if (consentTelemetry) logMiss('NDA', 'term_or_scope');
    } else {
      flags = evaluateNDARisk(extractedData, userContext, rules);
    }
  } else if (docType === 'LEASE') {
    extractedData = parseLease(normalizedText, definedTerms);
    
    // Example required fields
    if (!extractedData.monthlyRent || !extractedData.securityDepositMonths) {
      requiresAIFallback = true;
      missingClausesPayload.push({
        type: 'missing_financials',
        context: 'Could not confidently identify rent or deposit amounts.',
        rawTextToAnalyze: getContextSnippet('rent') // Added actual excerpt for AI
      });
      if (consentTelemetry) logMiss('LEASE', 'financials');
    } else {
      flags = evaluateLeaseRisk(extractedData, userContext, rules);
    }
  } else {
    // 4. Fallback for unsupported documents (Universal Generic Rules)
    extractedData = parseUniversal(normalizedText, definedTerms);
    
    if (extractedData.isFullyLocal) {
      requiresAIFallback = false;
      flags = evaluateUniversalRisk(extractedData, userContext, rules);
    } else {
      requiresAIFallback = true;
      missingClausesPayload.push({
        type: 'unsupported_document_type',
        context: 'Document requires deeper AI analysis to extract bespoke clauses.',
        rawTextToAnalyze: normalizedText.substring(0, 4000) // Send a larger chunk for AI fallback
      });
    }
  }

  return {
    docType,
    isFullyLocal: !requiresAIFallback,
    extractedData,
    flags,
    aiPayloadRecommendation: requiresAIFallback ? missingClausesPayload : null
  };
}

function identifyType(text) {
  const topText = text.substring(0, 1000).toLowerCase();
  if (topText.includes('non-disclosure') || topText.includes('confidentiality agreement')) {
    return 'NDA';
  }
  if (topText.includes('lease agreement') || topText.includes('tenant') && topText.includes('landlord')) {
    return 'LEASE';
  }
  return 'UNKNOWN';
}
