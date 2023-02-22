import { renderToString as render, type StyleSheet } from 'cassiopeia'
import type { CassiopeiaPlugin } from './types'

export const renderToString = <T extends CassiopeiaPlugin>(
  cassiopeia: T
): StyleSheet[] | undefined => {
  cassiopeia.update(false)

  return render(cassiopeia)
}
