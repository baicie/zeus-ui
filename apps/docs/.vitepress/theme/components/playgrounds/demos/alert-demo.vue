<template>
  <div class="primitive-demo" data-playground-demo="alert">
    <zw-alert variant="info" live="polite">
      <zw-alert-title>New version available</zw-alert-title>
      <zw-alert-description>
        Review the release notes before updating.
      </zw-alert-description>
    </zw-alert>
    <zw-alert variant="success" live="polite">
      <zw-alert-title>Deployment complete</zw-alert-title>
      <zw-alert-description>
        All production health checks passed.
      </zw-alert-description>
    </zw-alert>
    <zw-alert variant="danger" live="assertive">
      <zw-alert-title>Build failed</zw-alert-title>
      <zw-alert-description>
        Open the build log to inspect the failing step.
      </zw-alert-description>
    </zw-alert>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 0.875rem;
}

zw-alert {
  display: grid;
  gap: 0.25rem;
  padding: 0.875rem 1rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-left-width: 4px;
  border-radius: 0.625rem;
}

zw-alert[data-variant='info'] {
  background: var(--vp-c-brand-soft);
  border-left-color: var(--vp-c-brand-1);
}

zw-alert[data-variant='success'] {
  background: var(--vp-c-success-soft);
  border-left-color: var(--vp-c-success-1);
}

zw-alert[data-variant='danger'] {
  background: var(--vp-c-danger-soft);
  border-left-color: var(--vp-c-danger-1);
}

zw-alert-title {
  display: block;
  font-weight: 700;
  line-height: 1.35;
}

zw-alert-description {
  display: block;
  color: var(--vp-c-text-2);
  font-weight: 400;
  line-height: 1.5;
}
</style>
