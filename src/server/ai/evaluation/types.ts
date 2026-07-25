/** Evaluation hooks for future offline/online eval pipelines. */
export type EvaluationCase = {
  id: string;
  taskKey: string;
  input: unknown;
  expected?: unknown;
};

export interface EvaluationRunner {
  run(cases: EvaluationCase[]): Promise<{ passed: number; failed: number }>;
}

export class SnapshotEvaluationRunner implements EvaluationRunner {
  async run(cases: EvaluationCase[]) {
    // Deterministic placeholder — real scoring lands with live providers.
    return { passed: cases.length, failed: 0 };
  }
}
