/**
 * Rejects with `timeoutMessage` if `promise` does not settle within `ms`.
 * Use for Firestore calls that may hang when the client is stuck "offline".
 */
export function promiseWithTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    promise.then(
      (value) => {
        clearTimeout(t);
        resolve(value);
      },
      (reason) => {
        clearTimeout(t);
        reject(reason);
      }
    );
  });
}
