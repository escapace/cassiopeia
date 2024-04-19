import type { InjectionKey } from 'vue'
import type { Cassiopeia } from './types'

export const CASSIOPEIA_VUE_SYMBOL: InjectionKey<Cassiopeia> =
  Symbol.for('@cassiopeia/vue')

export const REGEX = /^---([\dA-Za-z]+)-([\dA-Za-z-]+)$/
