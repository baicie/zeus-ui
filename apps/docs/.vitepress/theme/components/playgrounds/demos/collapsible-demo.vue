<template>
  <div class="primitive-demo" data-playground-demo="collapsible">
    <zw-collapsible default-open>
      <zw-collapsible-trigger>Advanced settings</zw-collapsible-trigger>
      <zw-collapsible-content>
        <div class="demo-content">
          <p><strong>Cache strategy</strong></p>
          <p>Reuse verified build artifacts across CI jobs.</p>
        </div>
      </zw-collapsible-content>
    </zw-collapsible>
  </div>
</template>

<style scoped>
.primitive-demo {
  max-width: 32rem;
}

.demo-content {
  padding: 0.875rem 0;
  color: var(--vp-c-text-2);
}

.demo-content p {
  margin: 0;
}

.demo-content p + p {
  margin-top: 0.375rem;
}
</style>
