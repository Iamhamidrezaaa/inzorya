export function describeMockSnapshot(payload: unknown) {
  return {
    kind: "ai-mock-snapshot",
    payload,
  };
}
