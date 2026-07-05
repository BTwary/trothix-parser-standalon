// pdfProcessor.js - Handles client-side PDF ingestion, preprocessing, and UI state.

// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const UI = {
  desk: document.getElementById('desk'),
  pdfUpload: document.getElementById('pdfUpload'),
  inputState: document.getElementById('inputState'),
  progressState: document.getElementById('progressState'),
  readyCardState: document.getElementById('readyCardState'),
  defaultActionRow: document.getElementById('defaultActionRow'),
  consentNotice: document.querySelector('.consent-notice'),
  docInput: document.getElementById('docInput'),
  charCounter: document.getElementById('charCounter'),
  errorBox: document.getElementById('errorBox'),
  
  // Progress elements
  progRead: document.getElementById('prog-read'),
  progExtract: document.getElementById('prog-extract'),
  progPrepare: document.getElementById('prog-prepare'),
  progSections: document.getElementById('prog-sections'),
  
  // Ready Card elements
  rcDocType: document.getElementById('rcDocType'),
  rcFileName: document.getElementById('rcFileName'),
  rcPages: document.getElementById('rcPages'),
  rcChars: document.getElementById('rcChars'),
  rcStars: document.getElementById('rcStars'),
  rcEstimateTime: document.getElementById('rcEstimateTime'),
  rcSectionList: document.getElementById('rcSectionList'),
  previewBtn: document.getElementById('previewBtn'),
  analyzePdfBtn: document.getElementById('analyzePdfBtn')
};

// State Management
function showState(state) {
  UI.inputState.style.display = 'none';
  UI.progressState.style.display = 'none';
  UI.readyCardState.style.display = 'none';
  UI.defaultActionRow.style.display = 'flex';
  UI.consentNotice.style.display = 'block';
  UI.errorBox.style.display = 'none';
  
  if (state === 'input') {
    UI.inputState.style.display = 'block';
  } else if (state === 'progress') {
    UI.progressState.style.display = 'block';
    UI.defaultActionRow.style.display = 'none';
    UI.consentNotice.style.display = 'none';
  } else if (state === 'ready') {
    UI.readyCardState.style.display = 'block';
    UI.defaultActionRow.style.display = 'none';
    UI.consentNotice.style.display = 'none';
  }
}

function setActiveStage(stageId) {
  const stages = [UI.progRead, UI.progExtract, UI.progPrepare, UI.progSections];
  let found = false;
  stages.forEach(el => {
    if (!el) return;
    el.classList.remove('active');
    if (el.id === stageId) {
      el.classList.add('active');
      found = true;
    } else if (!found) {
      el.classList.add('done');
      el.innerHTML = el.innerHTML.replace('...', ' ✓');
    }
  });
}

function resetProgress() {
  const stages = [UI.progRead, UI.progExtract, UI.progPrepare, UI.progSections];
  const texts = ['Reading PDF...', 'Extracting Text...', 'Preparing Document...', 'Detecting Sections...'];
  stages.forEach((el, idx) => {
    if(!el) return;
    el.className = '';
    el.textContent = texts[idx];
  });
}

function showError(msg) {
  showState('input');
  UI.errorBox.textContent = msg;
  UI.errorBox.style.display = 'block';
}

// Drag & Drop Handlers
UI.desk.addEventListener('dragover', (e) => {
  e.preventDefault();
  UI.desk.classList.add('drag-active');
});
UI.desk.addEventListener('dragleave', (e) => {
  e.preventDefault();
  UI.desk.classList.remove('drag-active');
});
UI.desk.addEventListener('drop', (e) => {
  e.preventDefault();
  UI.desk.classList.remove('drag-active');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    processPDF(file);
  } else if (file) {
    showError("Please upload a PDF file.");
  }
});
UI.pdfUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) processPDF(file);
});

// PDF Pipeline
let currentAbortController = null;

async function processPDF(file) {
  if (file.size > 20 * 1024 * 1024) {
    showError("File is too large. Maximum size is 20MB.");
    return;
  }
  
  if (currentAbortController) {
    currentAbortController.abort();
  }
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  resetProgress();
  showState('progress');
  
  try {
    setActiveStage('prog-read');
    const arrayBuffer = await file.arrayBuffer();
    
    let pdf;
    try {
      pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    } catch (err) {
      if (err.name === 'PasswordException') {
        showError("This document is password protected. Remove the password and try again.");
      } else {
        showError("Could not read this PDF. It might be corrupted.");
      }
      return;
    }
    
    const pageCount = pdf.numPages;
    if (pageCount > 100) {
      showError(`This document has ${pageCount} pages. Trothix currently supports up to 100 pages.`);
      return;
    }
    
    setActiveStage('prog-extract');
    const { rawText } = await extractText(pdf, signal);
    
    if (!rawText.trim()) {
      showError("This document doesn't contain selectable text. OCR support is coming soon.");
      return;
    }
    
    setActiveStage('prog-prepare');
    await sleep(400); // Visual pacing
    const cleanedText = prepareDocument(rawText);
    
    setActiveStage('prog-sections');
    await sleep(400); // Visual pacing
    const structure = analyzeDocumentStructure(cleanedText);
    
    const extractionQuality = calculateQuality(rawText, cleanedText);
    const estimatedReviewSeconds = Math.max(3, Math.round(cleanedText.length / 3000));
    
    window.__trothixDocument = {
      id: "doc_" + Date.now(),
      fileName: file.name,
      documentType: structure.documentType,
      typeConfidence: structure.typeConfidence,
      extractionQuality,
      pageCount,
      rawText,
      cleanedText,
      extractedCharacters: rawText.length,
      cleanedCharacters: rawText.length - cleanedText.length,
      sections: structure.sections,
      metadata: {
        estimatedReviewSeconds,
        complexity: estimatedReviewSeconds > 10 ? 'High' : (estimatedReviewSeconds > 5 ? 'Medium' : 'Low'),
        aiRequestsNeeded: 1
      },
      createdAt: Date.now()
    };
    
    await sleep(300); // Final visual pacing
    populateReadyCard(window.__trothixDocument);
    showState('ready');
    
  } catch (err) {
    if (err.message === 'AbortError') {
      showState('input'); // Silent return to input state
      return;
    }
    console.error(err);
    showError("An unexpected error occurred while processing the PDF.");
  } finally {
    currentAbortController = null;
  }
}

async function extractText(pdf, signal) {
  let fullText = '';
  const pageCount = pdf.numPages;
  let ocrWorker = null;
  let isImageBased = false;

  for (let i = 1; i <= pageCount; i++) {
    if (signal && signal.aborted) {
      if (ocrWorker) await ocrWorker.terminate();
      throw new Error('AbortError');
    }
    
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    
    if (pageText.trim().length > 20) {
      fullText += pageText + '\n\n';
    } else {
      // Very little text found, likely a scanned image. Use Tesseract.
      if (typeof Tesseract !== 'undefined') {
        if (!isImageBased) {
          isImageBased = true;
          if (UI && UI.progExtract) UI.progExtract.innerHTML = `Image-based PDF detected. Initializing OCR engine... This may take a moment.`;
          ocrWorker = await Tesseract.createWorker('eng');
        }
        
        if (UI && UI.progExtract) UI.progExtract.innerHTML = `Image-based PDF detected. Running OCR (Page ${i} of ${pageCount})... This may take a moment.`;
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        
        try {
          const result = await ocrWorker.recognize(canvas);
          fullText += result.data.text + '\n\n';
        } catch (err) {
          console.warn("OCR failed on page", i, err);
        }
      } else {
        fullText += pageText + '\n\n';
      }
    }
  }
  
  if (ocrWorker) {
    await ocrWorker.terminate();
  }
  
  if (UI && UI.progExtract) UI.progExtract.innerHTML = "Extracting Text ✓";
  return { rawText: fullText, pageCount };
}

function prepareDocument(text) {
  let cleaned = text;
  // 1. Collapse multiple spaces
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  // 2. Remove isolated page numbers (e.g. at the bottom of pages)
  cleaned = cleaned.replace(/\n\s*\d+\s*\n/g, '\n\n');
  // 3. Rejoin broken paragraphs (lines ending without punctuation)
  cleaned = cleaned.replace(/([^.!?;\n])\n([a-z])/g, '$1 $2');
  // 4. Collapse multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

function analyzeDocumentStructure(text) {
  const sections = [];
  const patterns = [
    { id: 'payment', regex: /payment|compensation|fees|billing/i },
    { id: 'termination', regex: /termination|cancellation|severance/i },
    { id: 'liability', regex: /liability|indemnification|warranty/i },
    { id: 'confidentiality', regex: /confidentiality|non-disclosure|nda/i },
    { id: 'governing_law', regex: /governing law|jurisdiction|dispute resolution/i }
  ];
  
  // Search only the first 30% or up to 5000 chars for a general type
  const headerPreview = text.slice(0, 5000).toLowerCase();
  let documentType = "Contract";
  let typeConfidence = 0.85;
  
  if (headerPreview.includes("employment agreement") || headerPreview.includes("employment contract")) {
    documentType = "Employment Contract"; typeConfidence = 0.94;
  } else if (headerPreview.includes("non-disclosure") || headerPreview.includes("nda")) {
    documentType = "Non-Disclosure Agreement"; typeConfidence = 0.96;
  } else if (headerPreview.includes("lease") || headerPreview.includes("tenant")) {
    documentType = "Rental Agreement"; typeConfidence = 0.92;
  } else if (headerPreview.includes("terms of service") || headerPreview.includes("terms of use")) {
    documentType = "Terms of Service"; typeConfidence = 0.98;
  } else if (headerPreview.includes("independent contractor") || headerPreview.includes("freelance")) {
    documentType = "Freelance Agreement"; typeConfidence = 0.93;
  }
  
  // Detect sections
  patterns.forEach(p => {
    const match = text.match(new RegExp(`(^|\\n)\\s*\\d*\\.?\\s*(${p.regex.source})\\b`, 'i'));
    if (match) {
      sections.push({
        id: p.id,
        start: match.index,
        end: match.index + 200, // rough placeholder for structured chunking later
        confidence: 0.90,
        label: match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase()
      });
    }
  });
  
  return { documentType, typeConfidence, sections };
}

function calculateQuality(raw, cleaned) {
  if (!raw || raw.length === 0) return 1;
  const ratio = cleaned.length / raw.length;
  // If we cleaned out more than 30% of the characters, it was a messy extraction
  if (ratio < 0.7) return 2;
  if (ratio < 0.85) return 3;
  if (ratio < 0.95) return 4;
  return 5;
}

function populateReadyCard(doc) {
  UI.rcDocType.textContent = `📄 ${doc.documentType} (${Math.round(doc.typeConfidence * 100)}% Match)`;
  UI.rcFileName.textContent = doc.fileName;
  UI.rcPages.textContent = `${doc.pageCount} Pages`;
  UI.rcChars.textContent = `${doc.extractedCharacters.toLocaleString()} Characters`;
  let starStr = "";
  for (let i = 0; i < doc.extractionQuality; i++) starStr += "★";
  for (let i = doc.extractionQuality; i < 5; i++) starStr += "☆";
  const qualityText = doc.extractionQuality >= 4 ? "Excellent" : (doc.extractionQuality >= 3 ? "Good" : "Fair");

  UI.rcStars.textContent = `${starStr} ${qualityText}`;
  UI.rcEstimateTime.textContent = `${doc.metadata.estimatedReviewSeconds} seconds`;
  
  UI.rcSectionList.innerHTML = '';
  if (doc.sections.length > 0) {
    doc.sections.forEach(sec => {
      const tag = document.createElement('div');
      tag.className = 'rc-tag';
      tag.textContent = '✓ ' + sec.label;
      UI.rcSectionList.appendChild(tag);
    });
  } else {
    UI.rcSectionList.innerHTML = '<span style="color:var(--muted);font-size:12px;">Standard clauses</span>';
  }
}

// Ready Card Actions
UI.previewBtn.addEventListener('click', () => {
  const doc = window.__trothixDocument;
  if (!doc) return;
  UI.docInput.value = doc.cleanedText;
  
  // Trigger character counter update
  const event = new Event('input');
  UI.docInput.dispatchEvent(event);
  
  showState('input');
});

UI.analyzePdfBtn.addEventListener('click', () => {
  const doc = window.__trothixDocument;
  if (!doc) return;
  
  // Enforce consent check from the Ready Card
  const rcConsentCheck = document.getElementById('rcConsentCheck');
  if (rcConsentCheck && !rcConsentCheck.checked) {
    return; // Button should be disabled anyway, but safety check
  }
  
  // Populate the hidden textarea to reuse existing logic
  UI.docInput.value = doc.cleanedText;
  const event = new Event('input');
  UI.docInput.dispatchEvent(event);
  
  // Sync the main consent box
  const consentBox = document.getElementById('consentCheck');
  if (consentBox) {
    consentBox.checked = true;
  }
  
  // Reveal the normal action row and trigger click
  showState('input');
  document.getElementById('analyzeBtn').disabled = false;
  document.getElementById('analyzeBtn').click();
});

// Cancel button from Progress UI
const cancelPdfBtn = document.getElementById('cancelPdfBtn');
if (cancelPdfBtn) {
  cancelPdfBtn.addEventListener('click', () => {
    if (currentAbortController) {
      currentAbortController.abort();
    }
  });
}

// Utils
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
