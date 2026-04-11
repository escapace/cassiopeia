import { createExampleApp } from './create-app'

const container = document.querySelector('#app')
const hydrate = (container?.innerHTML.trim().length ?? 0) > 0
const { app } = createExampleApp({ hydrate })

app.mount('#app')
