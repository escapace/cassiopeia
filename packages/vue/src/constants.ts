import { InjectionKey } from 'vue'
import { CassiopeiaScope } from './types'

export const CASSIOPEIA_VUE_SYMBOL: InjectionKey<CassiopeiaScope> =
  Symbol.for('@cassiopeia/vue')

export const REGEX = /^---([a-zA-Z0-9]+)-([a-zA-Z-0-9]+)$/
