import type { z, ZodTypeAny } from "zod";

/** Success/failure result of validating unknown data against a schema. */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Validate `data` against `schema`, returning a discriminated result instead of
 * throwing. The error string is a compact, human-readable summary of every
 * issue (path + message), suitable for feeding back to the LLM as a repair hint
 * or showing the user.
 *
 * Inferring the return type from the schema (`z.infer<S>`) — rather than a bare
 * `ZodType<T>` — is important: schemas with `.default()` have a different input
 * vs. output type, and the output type is the validated value we return.
 */
export function validate<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
): ValidationResult<z.infer<S>> {
  const parsed = schema.safeParse(data);
  if (parsed.success) return { ok: true, value: parsed.data };
  const error = parsed.error.issues
    .map((i) => {
      const path = i.path.length > 0 ? i.path.join(".") : "(root)";
      return `${path}: ${i.message}`;
    })
    .join("; ");
  return { ok: false, error };
}

/** Validate and throw on failure. Use when invalid data is a programmer error. */
export function parseOrThrow<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = validate(schema, data);
  if (!result.ok) throw new Error(`validation failed: ${result.error}`);
  return result.value;
}
