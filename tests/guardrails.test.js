const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const GuardrailEngine = require('../src/core/guardrails.js');

describe('GuardrailEngine Tests', () => {
  test('intercepts acute chest pain emergency symptoms (SR-007)', () => {
    const input = "I am having crushing chest pain and numbness in my left hand";
    const result = GuardrailEngine.checkEmergencySymptoms(input);
    assert.equal(result.isEmergency, true);
    assert.match(result.actionMessage, /EMERGENCY PROTOCOL ACTIVATED/i);
    assert.equal(result.emergencyHelplines[0].number, "112");
  });

  test('does not trigger emergency on standard symptom queries', () => {
    const input = "My report says my fasting blood sugar is 108 mg/dL. Is that high?";
    const result = GuardrailEngine.checkEmergencySymptoms(input);
    assert.equal(result.isEmergency, false);
  });

  test('detects and redacts forbidden autonomous diagnostic phrasing (SR-001)', () => {
    const rawAiOutput = "Based on this report, you have diabetes and must start treatment immediately.";
    const sanitized = GuardrailEngine.sanitizeAIResponse(rawAiOutput);
    assert.equal(sanitized.violationDetected, true);
    assert.equal(sanitized.text.includes("you have diabetes"), false);
    assert.match(sanitized.text, /Disclaimer: Clara Health is an informational/i);
  });

  test('detects and redacts forbidden medication modification command (SR-002)', () => {
    const rawAiOutput = "Your cholesterol is high, stop taking your medicine and switch to garlic.";
    const sanitized = GuardrailEngine.sanitizeAIResponse(rawAiOutput);
    assert.equal(sanitized.violationDetected, true);
    assert.equal(sanitized.text.includes("stop taking your medicine"), false);
  });

  test('creates privacy-compliant safe audit logs without health data (NFR-006, NFR-011)', () => {
    const audit = GuardrailEngine.createSafeAuditPayload("user_45678", "DOCUMENT_UPLOAD", "doc_uuid_99");
    assert.ok(audit.userHash);
    assert.notEqual(audit.userHash, "user_45678");
    assert.equal(audit.action, "DOCUMENT_UPLOAD");
    assert.equal(audit.resourceId, "doc_uuid_99");
    // Ensure no health fields exist
    assert.equal(audit.biomarkers, undefined);
    assert.equal(audit.diagnoses, undefined);
    assert.equal(audit.rawText, undefined);
  });
});

