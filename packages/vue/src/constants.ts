import type { InjectionKey } from 'vue'
import type { Cassiopeia } from './types'

export const CASSIOPEIA_INJECTION_KEY: InjectionKey<Cassiopeia> = Symbol.for('@cassiopeia/vue')

export const REGEX = /^---([\dA-Z]+)-([\dA-Z-]+)$/i
