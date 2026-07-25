export type GuardrailResult = {
  ok: boolean;
  reasons: string[];
  maskedInput?: string;
  piiHits?: string[];
};

const PII_PATTERNS: { key: string; re: RegExp }[] = [
  { key: "email", re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { key: "phone", re: /\+?\d[\d\s()-]{8,}\d/g },
];

export function sanitizeInput(input: string): GuardrailResult {
  const reasons: string[] = [];
  let masked = input;
  const piiHits: string[] = [];

  if (!input || !input.trim()) {
    reasons.push("Empty input");
  }
  if (input.length > 100_000) {
    reasons.push("Input exceeds size limit");
  }
  // Basic prompt injection markers (hooks only — not a full policy engine)
  if (/ignore (all|previous) instructions/i.test(input)) {
    reasons.push("Suspicious instruction override detected");
  }

  for (const p of PII_PATTERNS) {
    if (p.re.test(input)) {
      piiHits.push(p.key);
      masked = masked.replace(p.re, `[REDACTED_${p.key.toUpperCase()}]`);
    }
    p.re.lastIndex = 0;
  }

  return {
    ok: reasons.length === 0,
    reasons,
    maskedInput: masked,
    piiHits,
  };
}

export function validateOutput(
  content: string,
  format: "json" | "markdown" | "text",
  schemaKeys?: string[],
): GuardrailResult {
  const reasons: string[] = [];
  if (!content?.trim()) reasons.push("Empty model output");

  if (format === "json") {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      if (schemaKeys) {
        for (const key of schemaKeys) {
          if (!(key in parsed)) reasons.push(`Missing output key: ${key}`);
        }
      }
    } catch {
      reasons.push("Output is not valid JSON");
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/** Hook placeholder for rate limiting (Redis/token bucket later). */
export function checkRateLimitHook(_workspaceId?: string | null): GuardrailResult {
  return { ok: true, reasons: [] };
}
