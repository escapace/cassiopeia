/* eslint-disable @typescript-eslint/method-signature-style */
import { type Cassiopeia, type Options as CassiopeiaOptions } from 'cassiopeia'

export interface CassiopeiaInjection {
  subscribe: Cassiopeia['subscribe']
  createScope: () => {
    add(variable: string[]): string[]
    add(variable: string): string
    clear: () => void
    delete: (variable: string | string[]) => void
    dispose: () => void
  }
  update: (isAsync?: boolean) => void
}

export interface Options extends Omit<CassiopeiaOptions, 'source'> {}
