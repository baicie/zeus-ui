<template>
  <div class="primitive-demo" data-playground-demo="card">
    <zw-card>
      <zw-card-header>
        <zw-card-title>Build status</zw-card-title>
        <zw-card-description>
          Production deployment for zeus-ui.
        </zw-card-description>
      </zw-card-header>
      <zw-card-content>
        <dl>
          <div>
            <dt>Branch</dt>
            <dd>main</dd>
          </div>
          <div>
            <dt>Checks</dt>
            <dd>21 passed</dd>
          </div>
        </dl>
      </zw-card-content>
      <zw-card-footer>
        <button type="button">View deployment</button>
      </zw-card-footer>
    </zw-card>
  </div>
</template>

<style scoped>
.primitive-demo {
  max-width: 30rem;
}

dl {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

dt {
  color: var(--vp-c-text-2);
}

dd {
  margin: 0;
  font-weight: 600;
}

button {
  padding: 0.5rem 0.75rem;
  color: var(--vp-c-brand-1);
  background: transparent;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 0.5rem;
  cursor: pointer;
}
</style>
