/**
 * Safety & Clinical Boundaries Guardrail Engine (PRD Section 6, SR-001 to SR-011)
 * Enforces non-diagnostic disclaimers, emergency symptom interception,
 * forbidden diagnostic phrases, and zero-health audit logging.
 */

class GuardrailEngine {
  static EMERGENCY_PATTERNS = [
    /crushing\s+(chest\s+pain|pressure)/i,
    /severe\s+(shortness\s+of\s+breath|breathlessness|difficulty\s+breathing)/i,
    /sudden\s+(numbness|weakness|loss\s+of\s+vision|paralysis)/i,
    /coughing\s+up\s+blood/i,
    /unconscious|fainting\s+repeatedly/i,
    /anaphylaxis|throat\s+swelling|lips\s+turning\s+blue/i
  ];

  static FORBIDDEN_DIAGNOSTIC_PHRASES = [
    /you\s+have\s+(diabetes|cancer|kidney\s+failure|heart\s+attack|hypertension)/i,
    /we\s+diagnose\s+you/i,
    /you\s+are\s+suffering\s+from/i,
    /stop\s+taking\s+(your\s+)?(medicine|pills|tablets|medication)/i,
    /increase\s+(your\s+)?dose/i,
    /decrease\s+(your\s+)?dose/i,
    /take\s+[0-9]+\s*mg\s+of/i
  ];

  /**
   * Evaluates input text for emergency medical symptoms (SR-007)
   */
  static checkEmergencySymptoms(inputText) {
    if (!inputText || typeof inputText !== 'string') {
      return { isEmergency: false };
    }

    for (const pattern of this.EMERGENCY_PATTERNS) {
      if (pattern.test(inputText)) {
        return {
          isEmergency: true,
          trigger: inputText.match(pattern)[0],
          actionMessage: "EMERGENCY PROTOCOL ACTIVATED: Your message describes potential urgent or emergency medical symptoms. Please contact emergency services immediately (Call 112 / 108 in India or your local emergency hospital) or proceed to the nearest emergency room. This assistant cannot diagnose or handle emergency conditions.",
          emergencyHelplines: [
            { region: "India National Emergency", number: "112" },
            { region: "India Medical Ambulance", number: "108" },
            { region: "US/Canada", number: "911" }
          ]
        };
      }
    }

    return { isEmergency: false };
  }

  /**
   * Validates AI-generated responses to ensure no autonomous diagnoses or medication changes leaked (SR-001, SR-002)
   */
  static sanitizeAIResponse(responseText) {
    if (!responseText || typeof responseText !== 'string') return responseText;

    let sanitized = responseText;
    let violationDetected = false;

    for (const pattern of this.FORBIDDEN_DIAGNOSTIC_PHRASES) {
      if (pattern.test(sanitized)) {
        violationDetected = true;
        // Redact and replace with safe clinical referral phrasing
        sanitized = sanitized.replace(pattern, "[Potential clinical correlation — discuss with doctor]");
      }
    }

    // Append mandatory statutory informational disclaimer (SR-001, SR-005)
    const disclaimer = "\n\n⚠️ Disclaimer: Clara Health is an informational and document-understanding assistant, not a clinical diagnostic system. Do not start, stop, or change medications without consulting a qualified medical professional.";

    if (!sanitized.includes("Disclaimer:")) {
      sanitized += disclaimer;
    }

    return {
      text: sanitized,
      violationDetected
    };
  }

  /**
   * Zero-Health-Data Audit Log Filter (NFR-006, NFR-011)
   * Sanitizes log payloads to ensure medical test names, values, or PII never enter system logs.
   */
  static createSafeAuditPayload(userId, action, resourceId, outcome = 'SUCCESS') {
    // Generate an irreversible hash representation of user ID for audit tracing
    const crypto = require('crypto');
    const hashedUser = crypto.createHash('sha256').update(String(userId)).digest('hex').substring(0, 16);

    return {
      timestamp: new Date().toISOString(),
      userHash: hashedUser,
      action: action, // e.g. "UPLOAD_DOCUMENT", "QUERY_CHAT", "EXPORT_PREP"
      resourceId: resourceId,
      outcome: outcome
      // Explicitly NO health data, no raw text, no biomarkers in logs!
    };
  }
}

module.exports = GuardrailEngine;

