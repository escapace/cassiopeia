import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { onTestFinished } from 'vitest'

export interface TemporaryDirectory {
  path: string
  cleanup: () => Promise<void>
}

export const createTemporaryDirectory = async (prefix: string): Promise<TemporaryDirectory> => {
  const temporaryRoot = path.join(process.cwd(), '.tmp')
  await mkdir(temporaryRoot, { recursive: true })

  const directory = await mkdtemp(path.join(temporaryRoot, prefix))
  let cleanupPromise: Promise<void> | undefined

  const cleanup = async () => {
    cleanupPromise ??= rm(directory, { force: true, recursive: true })
    await cleanupPromise
  }

  onTestFinished(cleanup)

  return {
    cleanup,
    path: directory,
  }
}
