/**
 * Race `promise` against a timeout so UI loading states always recover.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage = "Request timed out. Check your connection."): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
