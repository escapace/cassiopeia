<template>
  <main class="shell">
    <section class="card">
      <p class="eyebrow">Cassiopeia + Vue + Vite</p>
      <h1 class="title">The generated stylesheet should color this card and title.</h1>
      <p class="body">
        Open devtools and inspect the generated <code>&lt;style&gt;</code> tags or the SSR HTML output.
      </p>
      <ul class="checks">
        <li>surface uses <code>var(---theme-surface)</code></li>
        <li>title uses <code>var(---theme-primary)</code></li>
        <li>eyebrow uses <code>var(---theme-accent)</code></li>
        <li>body uses <code>var(---theme-muted)</code></li>
      </ul>
    </section>
  </main>
</template>

<style>
:root {
  color-scheme: light;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  line-height: 1.5;
}

body {
  margin: 0;
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
}

.shell {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 2rem;
}

.card {
  width: min(42rem, 100%);
  border: 1px solid color-mix(in oklab, var(---theme-primary) 16%, white);
  border-radius: 1rem;
  background: var(---theme-surface);
  box-shadow: 0 24px 64px -32px color-mix(in oklab, var(---theme-primary) 32%, transparent);
  padding: 2rem;
}

.eyebrow {
  margin: 0 0 0.75rem;
  color: var(---theme-accent);
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.title {
  margin: 0 0 1rem;
  color: var(---theme-primary);
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  line-height: 1.1;
}

.body,
.checks {
  color: var(---theme-muted);
}

.checks {
  margin: 1.25rem 0 0;
  padding-left: 1.25rem;
}

code {
  font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
</style>
