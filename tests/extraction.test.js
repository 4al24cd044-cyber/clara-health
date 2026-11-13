const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const ExtractionService = require('../src/services/extractionService.js');

describe('ExtractionService Tests', () => {
  test('correctly classifies discharge summaries, prescriptions, and lab reports', () => {
    assert.equal(ExtractionService.classifyDocumentType("Course in hospital: Patient admitted with fever... Date of discharge: Oct 12"), 'discharge_summary');
    assert.equal(ExtractionService.classifyDocumentType("Rx: Tab Atorvastatin 20mg daily at bedtime"), 'prescription');
    assert.equal(ExtractionService.classifyDocumentType("Biochemistry Department: Lipid Profile Serum Report"), 'lab_report');
  });

  test('extracts structured biomarkers with confidence, range, and bounding boxes', () => {
    const rawLines = [
      "Fasting Blood Glucose 104 mg/dL 70 - 110",
      "Total Cholesterol 210 mg/dL < 200",
      "Serum Creatinine 0.9 mg/dL 0.7 - 1.2"
    ];

    const results = ExtractionService.extractBiomarkers("doc_test_101", rawLines);
    assert.equal(results.length, 3);

    // Assert Glucose
    assert.equal(results[0].testName, "Fasting Blood Glucose");
    assert.equal(results[0].originalValue, 104);
    assert.equal(results[0].originalUnit, "mg/dL");
    assert.equal(results[0].triage.label, "Optimal");
    assert.equal(results[0].verifiedByUser, true);

    // Assert Cholesterol
    assert.equal(results[1].testName, "Total Cholesterol");
    assert.equal(results[1].originalValue, 210);
    assert.equal(results[1].triage.label, "Expected Variance"); // Mild variance
    assert.ok(results[1].boundingBox);
  });

  test('flags low confidence OCR extractions for human confirmation (SR-004)', () => {
    const rawLines = [
      { text: "HbA1c 6.8 % < 5.7", confidence: 0.72 } // Low confidence due to scan blur
    ];

    const results = ExtractionService.extractBiomarkers("doc_test_blur", rawLines);
    assert.equal(results.length, 1);
    assert.equal(results[0].confidence, 0.72);
    assert.equal(results[0].requiresUserConfirmation, true);
    assert.equal(results[0].verifiedByUser, false);
  });

  test('user verification updates result without overwriting original raw value (SR-003, SR-004)', () => {
    const originalRecord = {
      id: "res_123",
      testName: "Serum Creatinine",
      originalValue: 1.9, // OCR misread 0.9 as 1.9
      originalUnit: "mg/dL",
      referenceRange: "0.7 - 1.2",
      confidence: 0.70,
      requiresUserConfirmation: true,
      verifiedByUser: false
    };

    const userCorrection = { value: 0.9 };
    const verified = ExtractionService.verifyResultField(originalRecord, userCorrection);

    assert.equal(verified.originalValue, 1.9); // Preserved original
    assert.equal(verified.normalizedValue, 0.9); // Corrected value
    assert.equal(verified.verifiedByUser, true);
    assert.equal(verified.requiresUserConfirmation, false);
    assert.equal(verified.triage.label, "Optimal"); // 0.9 is within 0.7-1.2
  });
});

