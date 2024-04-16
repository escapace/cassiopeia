export const filter = <T>(array: T[], predicate: (value: T) => boolean) => {
  for (let l = array.length - 1; l >= 0; l -= 1) {
    if (!predicate(array[l])) array.splice(l, 1)
  }
}
