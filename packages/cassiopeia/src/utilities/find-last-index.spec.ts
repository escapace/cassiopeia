import { describe, it, expect } from 'vitest'
import { findLastIndex } from './find-last-index'

describe('findLastIndex', () => {
  it('should return the last index of an element that matches the predicate', () => {
    const array = [1, 2, 3, 2, 5]
    const predicate = (value: number) => value === 2

    const result = findLastIndex(array, predicate)

    expect(result).toBe(3)
  })

  it('should return -1 when no element matches the predicate', () => {
    const array = [1, 2, 3, 4, 5]
    const predicate = (value: number) => value === 6

    const result = findLastIndex(array, predicate)

    expect(result).toBe(-1)
  })

  it('should return -1 for empty array', () => {
    const array: number[] = []
    const predicate = (value: number) => value > 0

    const result = findLastIndex(array, predicate)

    expect(result).toBe(-1)
  })

  it('should return the correct index when only one element matches', () => {
    const array = [1, 2, 3, 4, 5]
    const predicate = (value: number) => value === 3

    const result = findLastIndex(array, predicate)

    expect(result).toBe(2)
  })

  it('should work with string arrays', () => {
    const array = ['apple', 'banana', 'cherry', 'banana', 'date']
    const predicate = (value: string) => value === 'banana'

    const result = findLastIndex(array, predicate)

    expect(result).toBe(3)
  })

  it('should work with object arrays', () => {
    const array = [
      { age: 25, name: 'Alice' },
      { age: 17, name: 'Bob' },
      { age: 25, name: 'Charlie' },
      { age: 30, name: 'David' },
    ]
    const predicate = (person: { age: number; name: string; }) => person.age === 25

    const result = findLastIndex(array, predicate)

    expect(result).toBe(2)
  })

  it('should pass value, index, and array to predicate function', () => {
    const array = [10, 20, 30]
    const predicate = (value: number, index: number, array_: number[]) => {
      expect(array_).toBe(array)
      return value === 20 && index === 1
    }

    const result = findLastIndex(array, predicate)

    expect(result).toBe(1)
  })

  it('should find last matching element with complex predicate', () => {
    const array = [1, 4, 7, 2, 8, 6, 9]
    const predicate = (value: number) => value > 5

    const result = findLastIndex(array, predicate)

    expect(result).toBe(6)
  })

  it('should return last index when all elements match', () => {
    const array = [2, 4, 6, 8]
    const predicate = (value: number) => value % 2 === 0

    const result = findLastIndex(array, predicate)

    expect(result).toBe(3)
  })
})