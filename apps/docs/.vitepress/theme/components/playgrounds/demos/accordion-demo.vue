<template>
  <div class="primitive-demo" data-playground-demo="accordion">
    <zw-accordion type="single" default-value="performance" collapsible>
      <zw-accordion-item value="performance">
        <zw-accordion-trigger
          >How does virtualization work?</zw-accordion-trigger
        >
        <zw-accordion-content>
          Only the visible row and column windows are rendered into the DOM.
        </zw-accordion-content>
      </zw-accordion-item>
      <zw-accordion-item value="frameworks">
        <zw-accordion-trigger
          >Which frameworks are supported?</zw-accordion-trigger
        >
        <zw-accordion-content>
          Zeus Web publishes Web Component, React, and Vue entry points.
        </zw-accordion-content>
      </zw-accordion-item>
      <zw-accordion-item value="accessibility">
        <zw-accordion-trigger
          >Is keyboard navigation included?</zw-accordion-trigger
        >
        <zw-accordion-content>
          Arrow keys move between triggers, while Enter and Space toggle them.
        </zw-accordion-content>
      </zw-accordion-item>
    </zw-accordion>
  </div>
</template>

<style scoped>
.primitive-demo {
  max-width: 38rem;
}

zw-accordion-content {
  display: block;
  padding: 0.75rem 0;
  color: var(--vp-c-text-2);
}
</style>
