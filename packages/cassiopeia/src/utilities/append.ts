import { Action } from '../types'

export const append = <T extends Action>(
  log: Action[],
  value: T,
  predicate: (value: Action) => boolean
) => {
  const i = log.findIndex(predicate)

  if (i === -1) {
    log.push(value)
  } else {
    log[i] = value
  }
}
