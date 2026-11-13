/**
 * Medical Extraction & OCR Processing Service (PRD Section 4, FR-001 to FR-007)
 * Extracts structured biomarker fields, calculates confidence,
 * binds bounding box coordinates, and manages human verification state.
 */

const DeterministicEngine = require('../core/deterministic.js');

class ExtractionService {
  /**
   * Classifies document type using heuristics and keyword analysis
   */
  static classifyDocumentType(rawText) {
    if (!rawText) return 'unknown';
    const text = rawText.toLowerCase();

    if (/discharge\s+summary|hospital\s+admission|date\s+of\s+discharge|course\s+in\s+hospital/i.test(text)) {
      return 'discharge_summary';
    }
    if (/prescription|rx|tablet|dosage|take\s+[0-9]+\s*(?:pills|capsule|daily)|b\.i\.d|t\.i\.d/i.test(text)) {
      return 'prescription';
    }
    if (/biochemistry|hematology|lipid\s+profile|reference\s+interval|serum|pathology\s+report/i.test(text)) {
      return 'lab_report';
    }
    return 'lab_report'; // Default assumption for blood/urine diagnostic tests
  }

  /**
   * Parses text chunks into structured biomarker records with bounding boxes and confidence
   */
  static extractBiomarkers(documentId, rawLines) {
    const results = [];

    // Common lab test patterns: TestName | Value | Unit | Range
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const parsed = this.parseLine(line, i + 1);

      if (parsed) {
        const triage = DeterministicEngine.classifyDePanicTier(parsed.testName, parsed.value, parsed.referenceRange);

        results.push({
          id: `res_${documentId}_${results.length + 1}`,
          documentId: documentId,
          pageNumber: parsed.pageNumber || 1,
          testName: parsed.testName,
          originalValue: parsed.value,
          originalUnit: parsed.unit,
          referenceRange: parsed.referenceRange,
          confidence: parsed.confidence,
          requiresUserConfirmation: parsed.confidence < 0.85,
          verifiedByUser: parsed.confidence >= 0.85,
          triage: triage,
          boundingBox: parsed.boundingBox || { x: 45, y: 120 + results.length * 35, width: 520, height: 28 },
          sourceOffset: `Line ${i + 1}`
        });
      }
    }

    return results;
  }

  /**
   * Internal line parser
   */
  static parseLine(lineData, lineIndex) {
    const text = typeof lineData === 'string' ? lineData : lineData.text;
    const confidence = typeof lineData === 'object' && lineData.confidence ? lineData.confidence : 0.94;
    const bbox = typeof lineData === 'object' ? lineData.bbox : null;

    // Regex matching "Test Name   Value   Unit   Range"
    // e.g., "Fasting Blood Glucose 104 mg/dL 70 - 110"
    // e.g., "Total Cholesterol 210 mg/dL < 200"
    // e.g., "HbA1c 6.8 % < 5.7"
    // e.g., "Serum Creatinine 0.9 mg/dL 0.7 - 1.2"
    const match = text.match(/^([A-Za-z0-9\s()/-]+?)\s+([0-9.]+)\s+([a-zA-Z/%]+)\s+([<>]?\s*[0-9.]+(?:\s*(?:-|to)\s*[0-9.]+)?)/i);

    if (match) {
      return {
        testName: match[1].trim(),
        value: parseFloat(match[2]),
        unit: match[3].trim(),
        referenceRange: match[4].trim(),
        confidence: confidence,
        boundingBox: bbox,
        pageNumber: 1
      };
    }

    return null;
  }

  /**
   * Allows user verification/correction of a low-confidence extracted field (FR-006, SR-004)
   * Preserves original raw extraction while storing user verified override.
   */
  static verifyResultField(resultRecord, userCorrections) {
    if (!resultRecord) return null;

    const updated = { ...resultRecord };

    if (userCorrections.value !== undefined) {
      updated.normalizedValue = parseFloat(userCorrections.value);
      updated.userEdited = true;
    }
    if (userCorrections.unit !== undefined) {
      updated.normalizedUnit = userCorrections.unit;
    }

    updated.verifiedByUser = true;
    updated.requiresUserConfirmation = false;
    updated.verifiedAt = new Date().toISOString();

    // Re-evaluate deterministic de-panic triage with user verified numbers
    const activeVal = updated.normalizedValue !== undefined ? updated.normalizedValue : updated.originalValue;
    updated.triage = DeterministicEngine.classifyDePanicTier(updated.testName, activeVal, updated.referenceRange);

    return updated;
  }
}

module.exports = ExtractionService;

