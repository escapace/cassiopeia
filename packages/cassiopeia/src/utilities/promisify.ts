export async function promisify<T>(
  fn: (callback: () => void) => void,
  promise: () => PromiseLike<T>
): Promise<T> {
  return await new Promise(
    (resolve) => void fn(() => void promise().then(resolve))
  )
}
