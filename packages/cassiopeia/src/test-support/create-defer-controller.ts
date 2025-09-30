export function createDeferController() {
  const queue: Array<() => void> = []
  let isManual = true // Default to manual control

  return {
    get count() {
      return queue.length
    },
    defer: (callback: () => void): number => {
      if (isManual) {
        // Manual mode: queue callback for later execution
        queue.push(callback)
        return queue.length - 1
      } else {
        // Automatic mode: execute immediately, transparently
        return setTimeout(callback) as unknown as number
      }
    },
    deferCancel: (id: number) => {
      if (isManual) {
        queue.splice(id, 1)
      } else {
        clearTimeout(id)
      }
    },
    executeAll: async () => {
      while (queue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve))
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
    isManual: () => isManual,
    queue,
    setManual: async (value = true) => {
      if (value !== isManual) {
        isManual = value

        // When switching to automatic, execute all queued callbacks
        if (!isManual) {
          while (queue.length > 0) {
            await new Promise((resolve) => setTimeout(resolve))
            queue.shift()!()
          }
        }
      }
    },
  }
}
