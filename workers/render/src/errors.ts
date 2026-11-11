/** Machine-readable failure codes stored on videos/name_clips. Never vendor text (it can echo the name). */
export type StageCode = "tts_failed" | "fit_failed" | "lipsync_failed" | "assemble_failed" | "spend_cap" | "data_deleted" | "unknown";

export class StageError extends Error {
  constructor(
    readonly code: StageCode,
    message: string,
    readonly retryable = true,
  ) {
    super(message);
  }
}

export function stageCode(error: unknown): StageCode {
  return error instanceof StageError ? error.code : "unknown";
}

/** Runs one pipeline stage and tags any failure with its code. */
export async function stage<T>(code: StageCode, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof StageError) throw error;
    throw new StageError(code, error instanceof Error ? error.message : String(error));
  }
}
