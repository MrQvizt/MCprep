/** Minutes to wait before attempt N+1 (index = attempts already made - 1). */
export const RETRY_BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360, 720, 1440];

export function nextAttemptDelayMs(attemptsMade: number): number {
  const idx = Math.min(Math.max(attemptsMade - 1, 0), RETRY_BACKOFF_MINUTES.length - 1);
  return RETRY_BACKOFF_MINUTES[idx] * 60_000;
}
