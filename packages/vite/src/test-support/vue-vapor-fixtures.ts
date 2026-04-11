export const vaporSfcSource = `
<script setup vapor>
const label='hello'
</script>
<template><button>{{label}}</button></template>
<style>.x{color:var(---theme-primary);border-color:var(---theme-secondary, red)}</style>
`

// Captured from a real build using vue@3.6.0-beta.9 and @vitejs/plugin-vue@6.0.5.
export const vaporClientCompiledModule = `
import { toDisplayString as _toDisplayString, openBlock as _openBlock, createElementBlock as _createElementBlock } from "vue"

const label='hello'

const _sfc_main = {
  __name: 'App',
  setup(__props) {


return (_ctx, _cache) => {
  return (_openBlock(), _createElementBlock("button", null, _toDisplayString(label)))
}
}

}


import "/virtual/App.vue?vue&type=style&index=0&lang.css"

export default _sfc_main
`

// Captured from a real SSR build using vue@3.6.0-beta.9 and @vitejs/plugin-vue@6.0.5.
export const vaporSsrCompiledModule = `
import { ssrRenderAttrs as _ssrRenderAttrs, ssrInterpolate as _ssrInterpolate } from "vue/server-renderer"

const label='hello'

const _sfc_main = {
  __name: 'App',
  __ssrInlineRender: true,
  setup(__props) {


return (_ctx, _push, _parent, _attrs) => {
  _push(\`<button\${
    _ssrRenderAttrs(_attrs)
  }>\${
    _ssrInterpolate(label)
  }</button>\`)
}
}

}


import "/virtual/App.vue?vue&type=style&index=0&lang.css"

import { useSSRContext as __vite_useSSRContext } from 'vue'
const _sfc_setup = _sfc_main.setup
_sfc_main.setup = (props, ctx) => {
  
const ssrContext = __vite_useSSRContext()
  ;(ssrContext.modules || (ssrContext.modules = new Set())).add("src/App.vue")
  return _sfc_setup ? _sfc_setup(props, ctx) : undefined
}
export default _sfc_main
`
