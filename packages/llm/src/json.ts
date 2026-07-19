/**
 * Extract a JSON object from a model completion. Even in JSON mode, small local
 * models occasionally wrap output in ```json fences or emit a line of prose
 * before the object. This pulls out the first balanced top-level `{...}` so the
 * caller can `JSON.parse` it. Returns null when no object is found.
 */
export function extractJsonObject(text: string): string | null {
  if (!text) return null;

  // Strip a leading code fence if present.
  let s = text.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence?.[1]) s = fence[1].trim();

  const start = s.indexOf("{");
  if (start === -1) return null;

  // Walk the string tracking brace depth, ignoring braces inside strings.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse a model completion into a plain JS value, or null if it isn't valid JSON. */
export function tryParseJson(text: string): unknown | null {
  const obj = extractJsonObject(text);
  if (obj === null) return null;
  try {
    return JSON.parse(obj);
  } catch {
    return null;
  }
}
