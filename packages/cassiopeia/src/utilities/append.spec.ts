import { describe, it, expect } from 'vitest'
import { append } from './append'
import type { Action } from '../types'
import { TypeAction } from '../types'

describe('append', () => {
  it('should append value to log when predicate does not match any existing item', () => {
    const log: Action[] = []
    const value: Action = { isAsync: false, type: TypeAction.UpdatePlugin }
    const predicate = (action: Action) => action.type === TypeAction.UpdateSource

    append(log, value, predicate)

    expect(log).toHaveLength(1)
    expect(log[0]).toBe(value)
  })

  it('should replace existing item when predicate matches', () => {
    const existingAction: Action = { isAsync: true, type: TypeAction.UpdatePlugin }
    const log: Action[] = [existingAction]
    const newValue: Action = { isAsync: false, type: TypeAction.UpdatePlugin }
    const predicate = (action: Action) => action.type === TypeAction.UpdatePlugin

    append(log, newValue, predicate)

    expect(log).toHaveLength(1)
    expect(log[0]).toBe(newValue)
    expect(log[0]).not.toBe(existingAction)
  })

  it('should replace first matching item when multiple items match predicate', () => {
    const action1: Action = { isAsync: true, type: TypeAction.UpdatePlugin }
    const action2: Action = { isAsync: false, type: TypeAction.UpdatePlugin }
    const log: Action[] = [action1, action2]
    const newValue: Action = { isAsync: true, type: TypeAction.UpdatePlugin }
    const predicate = (action: Action) => action.type === TypeAction.UpdatePlugin

    append(log, newValue, predicate)

    expect(log).toHaveLength(2)
    expect(log[0]).toBe(newValue)
    expect(log[1]).toBe(action2)
  })

  it('should append to end when predicate does not match any item in populated log', () => {
    const existingAction: Action = { isAsync: false, type: TypeAction.UpdatePlugin }
    const log: Action[] = [existingAction]
    const newValue: Action = { isAsync: true, type: TypeAction.UpdateSource }
    const predicate = (action: Action) => action.type === TypeAction.UpdateSource && !action.isAsync

    append(log, newValue, predicate)

    expect(log).toHaveLength(2)
    expect(log[0]).toBe(existingAction)
    expect(log[1]).toBe(newValue)
  })
})