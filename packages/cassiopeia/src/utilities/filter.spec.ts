/* eslint-disable unicorn/consistent-function-scoping */
import { describe, it, expect } from 'vitest'
import { filter } from './filter'

describe('filter', () => {
  it('should remove elements that do not match the predicate', () => {
    const array = [1, 2, 3, 4, 5]
    const predicate = (value: number) => value % 2 === 0

    filter(array, predicate)

    expect(array).toEqual([2, 4])
  })

  it('should keep all elements when all match the predicate', () => {
    const array = [2, 4, 6, 8]
    const predicate = (value: number) => value % 2 === 0

    filter(array, predicate)

    expect(array).toEqual([2, 4, 6, 8])
  })

  it('should remove all elements when none match the predicate', () => {
    const array = [1, 3, 5, 7]
    const predicate = (value: number) => value % 2 === 0

    filter(array, predicate)

    expect(array).toEqual([])
  })

  it('should handle empty array', () => {
    const array: number[] = []
    const predicate = (value: number) => value > 0

    filter(array, predicate)

    expect(array).toEqual([])
  })

  it('should work with string arrays', () => {
    const array = ['apple', 'banana', 'cherry', 'date']
    const predicate = (value: string) => value.length > 5

    filter(array, predicate)

    expect(array).toEqual(['banana', 'cherry'])
  })

  it('should work with object arrays', () => {
    const array = [
      { age: 25, name: 'Alice' },
      { age: 17, name: 'Bob' },
      { age: 30, name: 'Charlie' },
    ]
    const predicate = (person: { age: number; name: string; }) => person.age >= 18

    filter(array, predicate)

    expect(array).toEqual([
      { age: 25, name: 'Alice' },
      { age: 30, name: 'Charlie' },
    ])
  })

  it('should mutate the original array', () => {
    const originalArray = [1, 2, 3, 4, 5]
    const array = originalArray
    const predicate = (value: number) => value > 3

    filter(array, predicate)

    expect(originalArray).toEqual([4, 5])
    expect(array).toBe(originalArray)
  })
})
