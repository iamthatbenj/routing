import { describe, expect, it } from 'vitest';
import { assessDirectnessConstraint, parseDirectnessConstraint } from './directness-constraints';

describe('Directness constraint assessment', () => {
  it('keeps fastest baseline normal for every Directness', () => {
    expect(
      assessDirectnessConstraint({
        directness: 'Direct',
        durationSeconds: 20_000,
        fastestDurationSeconds: 17_000,
        source: 'ors-fastest',
        hasStrongReason: false
      }).status
    ).toBe('normal');
  });

  it('marks a route inside the normal Direct expectation as normal', () => {
    const assessment = assessDirectnessConstraint({
      directness: 'Direct',
      durationSeconds: 18_000,
      fastestDurationSeconds: 17_000,
      source: 'ors-anchor',
      hasStrongReason: true
    });

    expect(assessment.status).toBe('normal');
    expect(assessment.normalLimitSeconds).toBe(1_700);
  });

  it('marks a useful out-of-expectation route as constrained without calling it bad or unavailable', () => {
    const assessment = assessDirectnessConstraint({
      directness: 'Direct',
      durationSeconds: 19_000,
      fastestDurationSeconds: 17_000,
      source: 'ors-anchor',
      hasStrongReason: true
    });

    expect(assessment.status).toBe('constrained');
    expect(assessment.reason).toContain('compare with caution');
    expect(assessment.reason).not.toMatch(/bad|risky|unavailable/i);
  });

  it('uses broader normal expectations for Adventurous', () => {
    expect(
      assessDirectnessConstraint({
        directness: 'Adventurous',
        durationSeconds: 24_000,
        fastestDurationSeconds: 17_000,
        source: 'ors-anchor',
        hasStrongReason: true
      }).status
    ).toBe('normal');
  });

  it('parses persisted assessments defensively', () => {
    expect(parseDirectnessConstraint(JSON.stringify({ status: 'constrained', directness: 'Balanced', extraSeconds: 300 }))).toMatchObject({
      status: 'constrained',
      directness: 'Balanced',
      extraSeconds: 300
    });
    expect(parseDirectnessConstraint('not json')).toMatchObject({ status: 'normal' });
  });
});
