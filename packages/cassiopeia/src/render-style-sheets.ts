import { CASSIOPEIA_CONTEXT } from './constants'
import { createOrchestrator } from './create-orchestrator'
import type { CassiopeiaInstance, CassiopeiaStyleSheets } from './types'

export const renderStyleSheets = <T extends CassiopeiaInstance>(
  cassiopeia: T,
): CassiopeiaStyleSheets | undefined => {
  const context = cassiopeia[CASSIOPEIA_CONTEXT]
  const { generator, reducers } = context

  if (reducers === undefined || generator === undefined) {
    return undefined
  }

  const orchestrator = createOrchestrator({
    generator,
    reducers,
  })

  let token: ReturnType<typeof orchestrator.next>

  // eslint-disable-next-line no-empty
  while ((token = orchestrator.next()).done !== true) {}
  return token.value
}
