import type { Cassiopeia } from './types'

declare global {
  interface Window {
    __CASSIOPEIA_VUE__: Cassiopeia | undefined
  }
}
