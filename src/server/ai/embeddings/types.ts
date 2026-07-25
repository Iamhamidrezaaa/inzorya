/** Embedding interfaces reserved for a later sprint. */
export type EmbeddingVector = number[];

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<EmbeddingVector[]>;
  dimensions(): number;
}
