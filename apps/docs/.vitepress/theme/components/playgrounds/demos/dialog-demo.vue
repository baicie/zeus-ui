<template>
  <div class="primitive-demo" data-playground-demo="dialog">
    <zw-dialog>
      <zw-dialog-trigger>Open project dialog</zw-dialog-trigger>
      <zw-dialog-content>
        <zw-dialog-title>Create project</zw-dialog-title>
        <zw-dialog-description>
          Start a new workspace with the default Zeus Web configuration.
        </zw-dialog-description>
        <div class="demo-actions">
          <zw-dialog-close>Cancel</zw-dialog-close>
          <zw-dialog-close>Create project</zw-dialog-close>
        </div>
      </zw-dialog-content>
    </zw-dialog>
    <p class="demo-hint">
      Open the dialog, use <kbd>Tab</kbd> to move focus, or press
      <kbd>Escape</kbd> to close it.
    </p>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
  justify-items: start;
}

.demo-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.demo-hint {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
