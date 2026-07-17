export type Directness = 'Direct' | 'Balanced' | 'Adventurous';

export type DirectnessConstraintAssessment = {
  status: 'normal' | 'constrained' | 'omitted';
  directness: Directness;
  extraSeconds: number;
  extraRatio: number;
  normalLimitSeconds: number;
  constrainedLimitSeconds: number;
  reason: string;
};

type DirectnessPolicy = {
  normalRatio: number;
  normalMinimumSeconds: number;
  constrainedRatio: number;
  constrainedMinimumSeconds: number;
};

export const DIRECTNESS_POLICIES: Record<Directness, DirectnessPolicy> = {
  Direct: {
    normalRatio: 0.1,
    normalMinimumSeconds: 20 * 60,
    constrainedRatio: 0.18,
    constrainedMinimumSeconds: 35 * 60
  },
  Balanced: {
    normalRatio: 0.25,
    normalMinimumSeconds: 45 * 60,
    constrainedRatio: 0.4,
    constrainedMinimumSeconds: 75 * 60
  },
  Adventurous: {
    normalRatio: 0.6,
    normalMinimumSeconds: 2 * 60 * 60,
    constrainedRatio: 0.9,
    constrainedMinimumSeconds: 3 * 60 * 60
  }
};

export function assessDirectnessConstraint({
  directness,
  durationSeconds,
  fastestDurationSeconds,
  source,
  hasStrongReason
}: {
  directness: Directness;
  durationSeconds: number;
  fastestDurationSeconds: number;
  source: string;
  hasStrongReason: boolean;
}): DirectnessConstraintAssessment {
  const extraSeconds = Math.max(0, durationSeconds - fastestDurationSeconds);
  const extraRatio = fastestDurationSeconds > 0 ? extraSeconds / fastestDurationSeconds : 0;
  const policy = DIRECTNESS_POLICIES[directness];
  const normalLimitSeconds = Math.max(policy.normalMinimumSeconds, fastestDurationSeconds * policy.normalRatio);
  const constrainedLimitSeconds = Math.max(policy.constrainedMinimumSeconds, fastestDurationSeconds * policy.constrainedRatio);

  if (source === 'ors-fastest' || source === 'fallback-direct' || extraSeconds <= normalLimitSeconds) {
    return {
      status: 'normal',
      directness,
      extraSeconds,
      extraRatio,
      normalLimitSeconds,
      constrainedLimitSeconds,
      reason: `${directness} expectation met.`
    };
  }

  if (hasStrongReason && extraSeconds <= constrainedLimitSeconds) {
    return {
      status: 'constrained',
      directness,
      extraSeconds,
      extraRatio,
      normalLimitSeconds,
      constrainedLimitSeconds,
      reason: `${directness} expectation exceeded, but this Route Option has enough Anchor or Highlight interest to compare with caution.`
    };
  }

  return {
    status: 'omitted',
    directness,
    extraSeconds,
    extraRatio,
    normalLimitSeconds,
    constrainedLimitSeconds,
    reason: `${directness} expectation exceeded without enough route-relevant Anchor or Highlight interest to compare.`
  };
}

export function parseDirectnessConstraint(value: string | null | undefined): DirectnessConstraintAssessment {
  if (!value) return defaultAssessment();

  try {
    const parsed = JSON.parse(value) as Partial<DirectnessConstraintAssessment>;
    if (parsed.status !== 'normal' && parsed.status !== 'constrained' && parsed.status !== 'omitted') return defaultAssessment();
    if (parsed.directness !== 'Direct' && parsed.directness !== 'Balanced' && parsed.directness !== 'Adventurous') return defaultAssessment();

    return {
      status: parsed.status,
      directness: parsed.directness,
      extraSeconds: Number(parsed.extraSeconds ?? 0),
      extraRatio: Number(parsed.extraRatio ?? 0),
      normalLimitSeconds: Number(parsed.normalLimitSeconds ?? 0),
      constrainedLimitSeconds: Number(parsed.constrainedLimitSeconds ?? 0),
      reason: String(parsed.reason ?? '')
    };
  } catch {
    return defaultAssessment();
  }
}

function defaultAssessment(): DirectnessConstraintAssessment {
  return {
    status: 'normal',
    directness: 'Balanced',
    extraSeconds: 0,
    extraRatio: 0,
    normalLimitSeconds: 0,
    constrainedLimitSeconds: 0,
    reason: ''
  };
}
