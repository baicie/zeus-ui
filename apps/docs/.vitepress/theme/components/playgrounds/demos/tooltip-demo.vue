<template>
  <div class="primitive-demo" data-playground-demo="tooltip">
    <zw-tooltip delay-duration="120">
      <zw-tooltip-trigger>
        <span class="demo-trigger">Hover or focus for help</span>
      </zw-tooltip-trigger>
      <zw-tooltip-content side="top">
        This action creates a production deployment.
      </zw-tooltip-content>
    </zw-tooltip>
    <p class="demo-hint">
      Focus the trigger and press <kbd>Escape</kbd> to dismiss the tooltip.
    </p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
  justify-items: start;
  min-height: 7rem;
  padding-top: 2.5rem;
}

.demo-trigger {
  display: inline-flex;
  padding: 0.5rem 0.75rem;
  color: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 0.5rem;
}

.demo-hint {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
