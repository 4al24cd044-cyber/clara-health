/**
 * 5-Minute Doctor Consultation Preparation Service (PRD Section 4, FR-046 to FR-050)
 * Generates concise, high-yield questions for short clinic visits.
 */

class DoctorPrepService {
  /**
   * Generates prioritized questions and concise summary from verified results
   */
  static generateConsultationSheet(patientProfile, verifiedResults) {
    const questions = [];
    const keyFindings = [];

    for (const res of verifiedResults) {
      if (res.triage && res.triage.tier >= 2) {
        // Find borderline or actionable measurements
        if (/cholesterol|lipid/i.test(res.testName)) {
          questions.push({
            id: 'q_lipid',
            priority: 1,
            biomarker: res.testName,
            observed: `${res.originalValue} ${res.originalUnit}`,
            question: `My total cholesterol is ${res.originalValue} ${res.originalUnit}. Do you recommend lifestyle and diet modifications first, or do I need a statin?`,
            rationale: "HDL is optimal; patient seeks clarification on medication necessity."
          });
          keyFindings.push(`Total Cholesterol: ${res.originalValue} ${res.originalUnit} (Borderline)`);
        } else if (/glucose|hba1c|sugar/i.test(res.testName)) {
          questions.push({
            id: 'q_sugar',
            priority: 2,
            biomarker: res.testName,
            observed: `${res.originalValue} ${res.originalUnit}`,
            question: `My fasting glucose is ${res.originalValue} ${res.originalUnit}. Should I keep my current medication dosage or repeat this test in 3 months?`,
            rationale: "Ensures dose titration is confirmed by the doctor."
          });
          keyFindings.push(`Fasting Glucose: ${res.originalValue} ${res.originalUnit} (Optimal/Controlled)`);
        } else if (/creatinine|kidney/i.test(res.testName)) {
          questions.push({
            id: 'q_creatinine',
            priority: 3,
            biomarker: res.testName,
            observed: `${res.originalValue} ${res.originalUnit}`,
            question: `Serum Creatinine is ${res.originalValue} ${res.originalUnit}. Is this completely safe with my current blood pressure medication?`,
            rationale: "Checks renal safety."
          });
        }
      }
    }

    // Default fallback question if all values are optimal
    if (questions.length === 0) {
      questions.push({
        id: 'q_general',
        priority: 1,
        question: "All tests are in normal range. When do you recommend my next routine annual diagnostic check?",
        rationale: "Preventive maintenance timing."
      });
    }

    // Keep to max 3 prioritized questions for a 5-minute appointment
    const topQuestions = questions.slice(0, 3);

    return {
      patientName: patientProfile.name || "Patient",
      consultationDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      keyFindings: keyFindings,
      prioritizedQuestions: topQuestions,
      clinicalNotice: "This sheet is a personal organization tool to help you discuss your health with your doctor. It does not replace medical consultation."
    };
  }
}

module.exports = DoctorPrepService;

