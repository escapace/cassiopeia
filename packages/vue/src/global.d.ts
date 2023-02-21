import type { CassiopeiaScope } from './types'

declare global {
  interface Window {
    __CASSIOPEIA_VUE__: CassiopeiaScope | undefined
  }
}
