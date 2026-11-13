/**
 * Deterministic Clinical Rules Engine (PRD Section 13, FR-008 to FR-014)
 * Strict separation: All numerical, range, and triage classifications are deterministic.
 * ZERO LLM hallucinations allowed in numerical comparisons.
 */

class DeterministicEngine {
  /**
   * Parse a reference range string into numerical bounds
   * Handles: "70 - 110", "< 200", "> 60", "<= 5.7", "12.0-16.0", "Negative"
   */
  static parseRange(rangeStr) {
    if (!rangeStr || typeof rangeStr !== 'string') {
      return { low: null, high: null, qualitative: null, raw: rangeStr || '' };
    }

    const trimmed = rangeStr.trim();

    // Check for qualitative ranges (e.g. Negative, Non-Reactive, Normal)
    if (/^(negative|non-reactive|normal|nil|absent)$/i.test(trimmed)) {
      return { low: null, high: null, qualitative: trimmed.toLowerCase(), raw: rangeStr };
    }

    // Check for "< X" or "<= X"
    const lessMatch = trimmed.match(/^<\s*=?\s*([0-9.]+)/);
    if (lessMatch) {
      return { low: null, high: parseFloat(lessMatch[1]), qualitative: null, raw: rangeStr };
    }

    // Check for "> X" or ">= X"
    const greaterMatch = trimmed.match(/^>\s*=?\s*([0-9.]+)/);
    if (greaterMatch) {
      return { low: parseFloat(greaterMatch[1]), high: null, qualitative: null, raw: rangeStr };
    }

    // Check for "X - Y" or "X to Y"
    const rangeMatch = trimmed.match(/([0-9.]+)\s*(?:-|to)\s*([0-9.]+)/i);
    if (rangeMatch) {
      return { low: parseFloat(rangeMatch[1]), high: parseFloat(rangeMatch[2]), qualitative: null, raw: rangeStr };
    }

    return { low: null, high: null, qualitative: null, raw: rangeStr };
  }

  /**
   * Classifies a numeric or qualitative value against the supplied range
   * Returns: 'below_supplied_range' | 'within_normal' | 'above_supplied_range' | 'not_classifiable'
   */
  static classifyRange(value, rangeInput) {
    const range = typeof rangeInput === 'string' ? this.parseRange(rangeInput) : rangeInput;

    // Handle qualitative comparison
    if (range.qualitative) {
      if (typeof value === 'string' && value.toLowerCase().trim() === range.qualitative) {
        return 'within_normal';
      }
      return 'above_supplied_range';
    }

    const numVal = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(numVal)) {
      return 'not_classifiable';
    }

    if (range.low === null && range.high === null) {
      return 'not_classifiable';
    }

    if (range.low !== null && numVal < range.low) {
      return 'below_supplied_range';
    }

    if (range.high !== null && numVal > range.high) {
      return 'above_supplied_range';
    }

    return 'within_normal';
  }

  /**
   * De-Panic Triage Classifier (4 Tiers)
   * Prevents alarmism on minor or benign deviations
   * Tier 1: Optimal (Within range)
   * Tier 2: Expected Variance (Slight deviation <= 10% above/below threshold)
   * Tier 3: Actionable Trend (Moderate deviation 10% - 30%, needs lifestyle/follow-up)
   * Tier 4: Clinical Review (Significant deviation > 30% or critical red flag)
   */
  static classifyDePanicTier(testName, value, rangeInput) {
    const rangeStatus = this.classifyRange(value, rangeInput);

    if (rangeStatus === 'within_normal') {
      return {
        tier: 1,
        label: 'Optimal',
        badge: 'Healthy / Normal',
        color: 'emerald',
        reassurance: 'This reading is within the standard healthy reference range.'
      };
    }

    if (rangeStatus === 'not_classifiable') {
      return {
        tier: 1,
        label: 'Informational',
        badge: 'No Range Provided',
        color: 'slate',
        reassurance: 'No reference interval was printed on this report. Consult your physician for specific context.'
      };
    }

    const range = typeof rangeInput === 'string' ? this.parseRange(rangeInput) : rangeInput;
    const numVal = typeof value === 'number' ? value : parseFloat(value);

    // Calculate percent deviation beyond reference threshold
    let percentDeviation = 0;
    if (rangeStatus === 'above_supplied_range' && range.high !== null) {
      percentDeviation = ((numVal - range.high) / range.high) * 100;
    } else if (rangeStatus === 'below_supplied_range' && range.low !== null) {
      percentDeviation = ((range.low - numVal) / range.low) * 100;
    }

    if (percentDeviation <= 12) {
      return {
        tier: 2,
        label: 'Expected Variance',
        badge: 'Mild / Borderline Fluctuation',
        color: 'teal',
        reassurance: 'Slight variation common with hydration, recent meals, or timing. No emergency or panic required.'
      };
    } else if (percentDeviation <= 35) {
      return {
        tier: 3,
        label: 'Actionable Trend',
        badge: 'Worth Discussing with Doctor',
        color: 'amber',
        reassurance: 'Moderately out of typical target. Worth noting for routine consultation and lifestyle support.'
      };
    } else {
      return {
        tier: 4,
        label: 'Clinical Review',
        badge: 'Doctor Follow-Up Advised',
        color: 'rose',
        reassurance: 'Noticeably out of range. Recommend booking an appointment with your doctor for clinical evaluation.'
      };
    }
  }

  /**
   * Deterministic change over time (PRD FR-024)
   * Ensures unit compatibility before calculation
   */
  static calculateTrend(previousRecord, currentRecord) {
    if (!previousRecord || !currentRecord) return null;

    if (previousRecord.unit !== currentRecord.unit) {
      return {
        compatible: false,
        error: `Incompatible units: cannot compare ${previousRecord.unit} with ${currentRecord.unit}`
      };
    }

    const delta = currentRecord.value - previousRecord.value;
    const percentChange = ((delta / previousRecord.value) * 100).toFixed(1);

    return {
      compatible: true,
      delta: parseFloat(delta.toFixed(2)),
      percentChange: parseFloat(percentChange),
      direction: delta > 0 ? 'increasing' : delta < 0 ? 'decreasing' : 'stable',
      summary: `${delta > 0 ? '+' : ''}${delta.toFixed(2)} ${currentRecord.unit} (${delta > 0 ? '+' : ''}${percentChange}%)`
    };
  }
}

module.exports = DeterministicEngine;

