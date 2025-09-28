import { CASSIOPEIA_CONTEXT } from './constants'
import { createOrchestrator } from './create-orchestrator'
import type { CassiopeiaInstance, CassiopeiaStyleSheets } from './types'

/**
 * Extracts CSS stylesheets from a Cassiopeia instance for server-side rendering.
 *
 * Runs the orchestrator to completion by consuming its iterator, processing all triple-dash
 * custom properties (---key-suffix) through configured reducers. Each reducer transforms
 * custom properties into stylesheet content with metadata including reducer key, position
 * index, and optional attributes like media queries.
 *
 * Returns undefined when no generator or reducers are available, allowing graceful handling
 * of incomplete instance configurations during server-side rendering scenarios.
 *
 * @param cassiopeia - Cassiopeia instance containing generator and reducers for stylesheet processing
 * @returns Object containing stylesheet arrays and keys, or undefined if generator/reducers unavailable
 */
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
