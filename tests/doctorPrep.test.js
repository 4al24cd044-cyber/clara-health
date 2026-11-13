const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const DoctorPrepService = require('../src/services/doctorPrepService.js');

describe('DoctorPrepService Tests', () => {
  test('generates max 3 prioritized questions for 5-minute visit (FR-046)', () => {
    const verifiedResults = [
      { testName: 'Total Cholesterol', originalValue: 210, originalUnit: 'mg/dL', triage: { tier: 2 } },
      { testName: 'Fasting Blood Glucose', originalValue: 104, originalUnit: 'mg/dL', triage: { tier: 2 } },
      { testName: 'Serum Creatinine', originalValue: 0.9, originalUnit: 'mg/dL', triage: { tier: 2 } }
    ];

    const prep = DoctorPrepService.generateConsultationSheet({ name: 'Rajesh Kumar' }, verifiedResults);
    assert.equal(prep.patientName, 'Rajesh Kumar');
    assert.ok(prep.prioritizedQuestions.length <= 3);
    assert.equal(prep.prioritizedQuestions[0].id, 'q_lipid');
    assert.match(prep.prioritizedQuestions[0].question, /210 mg\/dL/i);
    assert.match(prep.clinicalNotice, /does not replace medical consultation/i);
  });
});

