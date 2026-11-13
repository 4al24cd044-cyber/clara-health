const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const DeterministicEngine = require('../src/core/deterministic.js');

describe('DeterministicEngine Tests', () => {
  test('parses two-sided ranges correctly', () => {
    const range = DeterministicEngine.parseRange('70 - 110');
    assert.equal(range.low, 70);
    assert.equal(range.high, 110);
  });

  test('parses one-sided upper bound (< 200)', () => {
    const range = DeterministicEngine.parseRange('< 200');
    assert.equal(range.low, null);
    assert.equal(range.high, 200);
  });

  test('parses one-sided lower bound (> 60)', () => {
    const range = DeterministicEngine.parseRange('> 60');
    assert.equal(range.low, 60);
    assert.equal(range.high, null);
  });

  test('parses qualitative range (Negative)', () => {
    const range = DeterministicEngine.parseRange('Negative');
    assert.equal(range.qualitative, 'negative');
  });

  test('classifies values correctly against range boundaries', () => {
    assert.equal(DeterministicEngine.classifyRange(65, '70 - 110'), 'below_supplied_range');
    assert.equal(DeterministicEngine.classifyRange(70, '70 - 110'), 'within_normal');
    assert.equal(DeterministicEngine.classifyRange(104, '70 - 110'), 'within_normal');
    assert.equal(DeterministicEngine.classifyRange(110, '70 - 110'), 'within_normal');
    assert.equal(DeterministicEngine.classifyRange(142, '70 - 110'), 'above_supplied_range');
    assert.equal(DeterministicEngine.classifyRange(210, '< 200'), 'above_supplied_range');
    assert.equal(DeterministicEngine.classifyRange(180, '< 200'), 'within_normal');
  });

  test('de-panic triage classifies mild deviation as Tier 2 (Expected Variance)', () => {
    // 210 vs 200 is a 5% deviation -> Tier 2 (Expected Variance)
    const triage = DeterministicEngine.classifyDePanicTier('Total Cholesterol', 210, '< 200');
    assert.equal(triage.tier, 2);
    assert.equal(triage.label, 'Expected Variance');
    assert.match(triage.reassurance, /No emergency or panic required/i);
  });

  test('de-panic triage classifies normal reading as Tier 1 (Optimal)', () => {
    const triage = DeterministicEngine.classifyDePanicTier('Glucose', 95, '70 - 110');
    assert.equal(triage.tier, 1);
    assert.equal(triage.label, 'Optimal');
  });

  test('de-panic triage classifies severe deviation as Tier 4 (Clinical Review)', () => {
    // 350 vs 200 is a 75% deviation -> Tier 4
    const triage = DeterministicEngine.classifyDePanicTier('Total Cholesterol', 350, '< 200');
    assert.equal(triage.tier, 4);
    assert.equal(triage.label, 'Clinical Review');
  });

  test('calculates trend with compatible units', () => {
    const prev = { value: 7.2, unit: '%' };
    const curr = { value: 6.8, unit: '%' };
    const trend = DeterministicEngine.calculateTrend(prev, curr);
    assert.equal(trend.compatible, true);
    assert.equal(trend.delta, -0.4);
    assert.equal(trend.direction, 'decreasing');
  });

  test('rejects trend calculation for incompatible units', () => {
    const prev = { value: 120, unit: 'mg/dL' };
    const curr = { value: 6.5, unit: 'mmol/L' };
    const trend = DeterministicEngine.calculateTrend(prev, curr);
    assert.equal(trend.compatible, false);
    assert.match(trend.error, /Incompatible units/i);
  });
});

