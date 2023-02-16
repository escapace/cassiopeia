import { InjectionKey } from 'vue'
import { CassiopeiaInjection } from './types'

export const INJECTION_KEY_CASSIOPEIA: InjectionKey<CassiopeiaInjection> =
  Symbol.for('@cassiopeia/vue')

export const REGEX = /^---([a-zA-Z0-9]+)-([a-zA-Z-0-9]+)$/
