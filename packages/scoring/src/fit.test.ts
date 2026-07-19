import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyScore,
  clampScore,
  describeFit,
  isStretch,
  summarizeFit,
  type ScoredItem,
} from "./fit.js";

test("clampScore bounds into 0..100 and handles NaN", () => {
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(0), 0);
  assert.equal(clampScore(42), 42);
  assert.equal(clampScore(100), 100);
  assert.equal(clampScore(140), 100);
  assert.equal(clampScore(Number.NaN), 0);
});

test("classifyScore maps each band to the right tier (boundaries inclusive)", () => {
  assert.equal(classifyScore(100), "strong");
  assert.equal(classifyScore(85), "strong");
  assert.equal(classifyScore(84), "reasonable");
  assert.equal(classifyScore(70), "reasonable");
  assert.equal(classifyScore(69), "weak");
  assert.equal(classifyScore(50), "weak");
  assert.equal(classifyScore(49), "very_weak");
  assert.equal(classifyScore(30), "very_weak");
  assert.equal(classifyScore(29), "stretch");
  assert.equal(classifyScore(0), "stretch");
});

test("classifyScore honors custom thresholds", () => {
  const strict = { strong: 95, reasonable: 80, weak: 60, very_weak: 40 };
  assert.equal(classifyScore(90, strict), "reasonable");
  assert.equal(classifyScore(95, strict), "strong");
});

test("describeFit softens weak/very_weak/stretch to 'a stretch'", () => {
  assert.equal(describeFit("strong"), "a strong fit");
  assert.equal(describeFit("reasonable"), "a reasonable fit");
  assert.equal(describeFit("weak"), "a stretch");
  assert.equal(describeFit("very_weak"), "a stretch");
  assert.equal(describeFit("stretch"), "a stretch");
});

test("isStretch is true only for the lower three tiers", () => {
  assert.equal(isStretch("strong"), false);
  assert.equal(isStretch("reasonable"), false);
  assert.equal(isStretch("weak"), true);
  assert.equal(isStretch("very_weak"), true);
  assert.equal(isStretch("stretch"), true);
});

test("summarizeFit weights required items above preferred", () => {
  // One required item scored low, one preferred item scored high.
  // With required weight 2 and preferred weight 1, the low required score
  // should pull the weighted average below a naive mean of the two.
  const items: ScoredItem[] = [
    { label: "Required skill", score: 40, importance: "required" },
    { label: "Preferred skill", score: 90, importance: "preferred" },
  ];
  const summary = summarizeFit(items);
  // weighted = (40*2 + 90*1) / 3 = 170/3 = 56.67 -> 57
  assert.equal(summary.overallScore, 57);
  assert.equal(summary.overallTier, "weak");
  assert.equal(summary.verdict, "a stretch");
});

test("summarizeFit reports tier counts and critical (required) gaps", () => {
  const items: ScoredItem[] = [
    { label: "Strong required", score: 90, importance: "required" },
    { label: "Weak required", score: 45, importance: "required" },
    { label: "Weak preferred", score: 45, importance: "preferred" },
    { label: "Stretch required", score: 10, importance: "required" },
  ];
  const summary = summarizeFit(items);
  assert.equal(summary.tierCounts.strong, 1);
  assert.equal(summary.tierCounts.very_weak, 2);
  assert.equal(summary.tierCounts.stretch, 1);
  // Only REQUIRED stretch/weak items are critical gaps: the weak required and
  // the stretch required — not the weak PREFERRED one.
  assert.equal(summary.criticalGaps.length, 2);
  assert.deepEqual(
    summary.criticalGaps.map((g) => g.label).sort(),
    ["Stretch required", "Weak required"],
  );
});

test("summarizeFit treats an empty job as a stretch, not a crash", () => {
  const summary = summarizeFit([]);
  assert.equal(summary.overallScore, 0);
  assert.equal(summary.overallTier, "stretch");
  assert.equal(summary.criticalGaps.length, 0);
});
