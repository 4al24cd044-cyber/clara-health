const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const RAGService = require('../src/services/ragService.js');

describe('RAGService Grounded QA Tests', () => {
  let rag;

  beforeEach(() => {
    rag = new RAGService();
    // Index a sample report with Cholesterol and Glucose only (no Thyroid/TSH)
    rag.indexDocument("doc_metabolic_01", [
      { text: "Total Cholesterol 210 mg/dL Reference Range: < 200 mg/dL", pageNumber: 1, sourceOffset: "Page 1, Row 4" },
      { text: "Fasting Blood Glucose 104 mg/dL Reference Range: 70 - 110 mg/dL", pageNumber: 1, sourceOffset: "Page 1, Row 5" },
      { text: "Serum Creatinine 0.9 mg/dL Reference Range: 0.7 - 1.2 mg/dL", pageNumber: 1, sourceOffset: "Page 1, Row 6" }
    ]);
  });

  test('answers grounded query with page citations when evidence is present', async () => {
    const res = await rag.askReport("doc_metabolic_01", "What is my cholesterol level?");
    assert.equal(res.isRefusal, false);
    assert.match(res.answer, /210 mg\/dL/i);
    assert.ok(res.citations.length > 0);
    assert.equal(res.citations[0].sourceOffset, "Page 1, Row 4");
    assert.match(res.answer, /Disclaimer: Clara Health is an informational/i);
  });

  test('refuses to guess when requested information is absent from report (FR-031, SR-006)', async () => {
    const res = await rag.askReport("doc_metabolic_01", "What is my Thyroid TSH level?");
    assert.equal(res.isRefusal, true);
    assert.match(res.answer, /information is not present in your uploaded medical report/i);
    assert.equal(res.citations.length, 0);
  });

  test('escalates emergency symptoms immediately and aborts standard QA (SR-007)', async () => {
    const res = await rag.askReport("doc_metabolic_01", "I feel crushing chest pain and breathlessness");
    assert.equal(res.isEmergency, true);
    assert.match(res.answer, /EMERGENCY PROTOCOL ACTIVATED/i);
    assert.equal(res.emergencyHelplines[0].number, "112");
  });
});

