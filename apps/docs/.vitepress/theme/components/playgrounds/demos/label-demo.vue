<template>
  <div class="primitive-demo" data-playground-demo="label">
    <div class="demo-field">
      <zw-label for="playground-email" required>Email address</zw-label>
      <input id="playground-email" type="email" placeholder="you@example.com" />
    </div>
    <div class="demo-field">
      <zw-label for="playground-team" disabled>Managed team</zw-label>
      <input id="playground-team" value="Platform" disabled />
    </div>
  </div>
</template>

<style scoped>
.primitive-demo,
.demo-field {
  display: grid;
  gap: 0.5rem;
}

.primitive-demo {
  gap: 1rem;
  max-width: 28rem;
}

input {
  min-height: 2.5rem;
  padding: 0 0.75rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 0.5rem;
}
</style>
