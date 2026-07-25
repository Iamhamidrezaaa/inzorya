export type { StreamChunk } from "@/server/ai/providers/types";

/** Streaming contract — mock provider implements token/partial/done/error. */
export type StreamController = {
  cancel: () => void;
};
