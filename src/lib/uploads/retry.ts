export async function retry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; delayMs?: number },
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < opts.maxAttempts && opts.delayMs) {
        await new Promise((r) => setTimeout(r, opts.delayMs));
      }
    }
  }
  throw lastError;
}
