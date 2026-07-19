import type { LinkedInChange, LinkedInChangeSet } from "@resume-prep/schema";

/**
 * Abstraction over "type this value into this LinkedIn field". A real
 * implementation would drive the user's logged-in browser; the engine only
 * depends on this interface so the flow is testable with a mock and carries no
 * browser dependency.
 */
export interface AssistedFillDriver {
  fillField(field: string, value: string): Promise<void>;
}

export interface AssistedFillOptions {
  /**
   * Master switch. MUST be explicitly true to attempt any fill. Mirrors the
   * `LINKEDIN_ASSISTED_FILL` env flag. When false, applying throws — the safe
   * copy-paste path is the default (DESIGN.md §9).
   */
  enabled: boolean;
  /**
   * Per-change confirmation. Called for every change; the fill happens only if
   * it resolves truthy. Defaults to REJECTING every change, so nothing is
   * applied unless the caller wires an explicit approval step.
   */
  confirm?: (change: LinkedInChange) => boolean | Promise<boolean>;
}

export interface AssistedFillResult {
  applied: string[];
  skipped: string[];
}

/**
 * Attempt to apply a change set via the browser driver — opt-in and
 * confirmation-gated. This carries real ToS/account risk, so it refuses unless
 * `enabled` is explicitly true and each change is individually confirmed. It is
 * never a replacement for the copy-paste change set, only a convenience over it.
 */
export async function applyLinkedInChanges(
  changeSet: LinkedInChangeSet,
  driver: AssistedFillDriver,
  opts: AssistedFillOptions,
): Promise<AssistedFillResult> {
  if (!opts.enabled) {
    throw new Error(
      "assisted fill is disabled. Set enabled:true (LINKEDIN_ASSISTED_FILL) to use it; the copy-paste change set is the default, ToS-safe path.",
    );
  }

  const confirm = opts.confirm ?? (() => false);
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const change of changeSet.changes) {
    if (await confirm(change)) {
      await driver.fillField(change.field, change.suggested);
      applied.push(change.field);
    } else {
      skipped.push(change.field);
    }
  }

  return { applied, skipped };
}
