export const filter = <T>(arr: T[], predicate: (value: T) => boolean) => {
  for (let l = arr.length - 1; l >= 0; l -= 1) {
    if (!predicate(arr[l])) arr.splice(l, 1)
  }
}
