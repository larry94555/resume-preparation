/**
 * Deterministic scoring & fit-classification core.
 *
 * The LLM produces raw 0–100 scores for individual skills and experiences (see
 * DESIGN.md, "Scoring & judgment"). Everything in this file is PURE and
 * DETERMINISTIC: given the same scores it always yields the same tiers and the
 * same aggregate. Keeping the classification/aggregation out of the model makes
 * the "why is this a fit vs. a stretch" judgment auditable and unit-testable,
 * and keeps the tier thresholds in one place the user can tune.
 */

/** The five canonical fit tiers, best → worst. A single 0–100 score maps to exactly one. */
export type FitTier = "strong" | "reasonable" | "weak" | "very_weak" | "stretch";

/** Whether a requirement is mandatory ("required") or a nice-to-have ("preferred"). */
export type Importance = "required" | "preferred";

/** Lower-inclusive score band for each tier. Ordered best → worst. */
export interface TierThresholds {
  strong: number; // score >= strong  → "strong"
  reasonable: number; // score >= reasonable → "reasonable"
  weak: number; // score >= weak       → "weak"
  very_weak: number; // score >= very_weak  → "very_weak"; below → "stretch"
}

/** Default bands. Tunable per DESIGN.md; kept conservative so "strong" means strong. */
export const DEFAULT_THRESHOLDS: TierThresholds = {
  strong: 85,
  reasonable: 70,
  weak: 50,
  very_weak: 30,
};

/** Clamp any number into the inclusive 0–100 score range. */
export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, score));
}

/** Classify a single 0–100 score into a {@link FitTier}. */
export function classifyScore(
  score: number,
  thresholds: TierThresholds = DEFAULT_THRESHOLDS,
): FitTier {
  const s = clampScore(score);
  if (s >= thresholds.strong) return "strong";
  if (s >= thresholds.reasonable) return "reasonable";
  if (s >= thresholds.weak) return "weak";
  if (s >= thresholds.very_weak) return "very_weak";
  return "stretch";
}

/**
 * User-facing phrasing for a tier. "weak", "very_weak", and "stretch" are all
 * softened to "a stretch" in conversation, because — as the spec notes — a
 * stretch is the polite way to describe a weak/very-weak match. The precise tier
 * is still available programmatically via {@link classifyScore} for the score
 * breakdown the user can drill into.
 */
export function describeFit(tier: FitTier): string {
  switch (tier) {
    case "strong":
      return "a strong fit";
    case "reasonable":
      return "a reasonable fit";
    case "weak":
    case "very_weak":
    case "stretch":
      return "a stretch";
  }
}

/** True for the tiers that are, diplomatically, "a stretch". */
export function isStretch(tier: FitTier): boolean {
  return tier === "weak" || tier === "very_weak" || tier === "stretch";
}

/** A single scored requirement (one skill or one experience) drawn from a job description. */
export interface ScoredItem {
  /** Human label, e.g. "Kubernetes" or "5+ years managing distributed teams". */
  label: string;
  /** Raw 0–100 score of how well the resume/LinkedIn evidences this item. */
  score: number;
  /** Whether the job lists this as required or merely preferred. */
  importance: Importance;
}

/** Relative weight of a required item vs. a preferred one when aggregating. */
export interface AggregateWeights {
  required: number;
  preferred: number;
}

export const DEFAULT_WEIGHTS: AggregateWeights = { required: 2, preferred: 1 };

export interface FitSummary {
  /** Weighted-average score across all items, 0–100. */
  overallScore: number;
  /** Tier of the overall score. */
  overallTier: FitTier;
  /** User-facing phrasing of the overall tier. */
  verdict: string;
  /** Count of items in each tier, for the breakdown UI. */
  tierCounts: Record<FitTier, number>;
  /** Required items whose tier is a stretch — the gaps that most threaten the application. */
  criticalGaps: ScoredItem[];
}

/**
 * Aggregate per-item scores into an overall fit summary. Required items count
 * more than preferred ones (see {@link DEFAULT_WEIGHTS}); a job with zero items
 * is treated as a stretch (no evidence of fit) rather than a divide-by-zero.
 */
export function summarizeFit(
  items: ScoredItem[],
  weights: AggregateWeights = DEFAULT_WEIGHTS,
  thresholds: TierThresholds = DEFAULT_THRESHOLDS,
): FitSummary {
  const tierCounts: Record<FitTier, number> = {
    strong: 0,
    reasonable: 0,
    weak: 0,
    very_weak: 0,
    stretch: 0,
  };

  let weightedSum = 0;
  let weightTotal = 0;
  const criticalGaps: ScoredItem[] = [];

  for (const item of items) {
    const w = item.importance === "required" ? weights.required : weights.preferred;
    const s = clampScore(item.score);
    weightedSum += s * w;
    weightTotal += w;

    const tier = classifyScore(s, thresholds);
    tierCounts[tier] += 1;
    if (item.importance === "required" && isStretch(tier)) {
      criticalGaps.push(item);
    }
  }

  const overallScore = weightTotal === 0 ? 0 : Math.round(weightedSum / weightTotal);
  const overallTier = classifyScore(overallScore, thresholds);

  return {
    overallScore,
    overallTier,
    verdict: describeFit(overallTier),
    tierCounts,
    criticalGaps,
  };
}
