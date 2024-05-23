import type { Action } from '../types'

export const append = <T extends Action>(
  log: Action[],
  value: T,
  predicate: (value: Action) => boolean,
) => {
  const index = log.findIndex(predicate)

  if (index === -1) {
    log.push(value)
  } else {
    log[index] = value
  }
}
