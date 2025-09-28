export function createDeferController() {
  const queue: Array<() => void> = []
  let manual = true // Default to manual control

  return {
    get count() {
      return queue.length
    },
    defer: (callback: () => void) => {
      if (manual) {
        // Manual mode: queue callback for later execution
        queue.push(callback)
      } else {
        // Automatic mode: execute immediately, transparently
        callback()
      }
    },
    executeAll: () => {
      while (queue.length > 0) {
        queue.shift()!()
      }
    },
    executeNext: () => {
      const callback = queue.shift()
      if (callback !== undefined) {
        callback()
        return true
      }
      return false
    },
    hasQueued: () => queue.length > 0,
    isManual: () => manual,
    queue,
    setManual: (value: boolean) => {
      manual = value
      if (!manual) {
        // When switching to automatic, execute all queued callbacks
        while (queue.length > 0) {
          queue.shift()!()
        }
      }
    },
  }
}
