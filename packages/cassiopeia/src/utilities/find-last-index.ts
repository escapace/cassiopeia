export function findLastIndex<T>(
  array: T[],
  predicate: (value: T, index: number, object: T[]) => boolean,
): number {
  let l = array.length
  // eslint-disable-next-line typescript/strict-boolean-expressions
  while (l--) {
    if (predicate(array[l], l, array)) return l
  }
  return -1
}
