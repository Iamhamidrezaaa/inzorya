import { describeMockSnapshot } from "@/server/ai/testing/snapshots";

/** Lightweight helper so future tests can assert deterministic mock payloads. */
export function assertMockJsonShape(content: string) {
  const parsed = JSON.parse(content) as { ok?: boolean; provider?: string };
  if (parsed.ok !== true || parsed.provider !== "mock") {
    throw new Error("Unexpected mock payload shape");
  }
  return describeMockSnapshot(parsed);
}
