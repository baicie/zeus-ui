<template>
  <div class="primitive-demo" data-playground-demo="avatar">
    <div class="demo-profile">
      <zw-avatar size="lg" image-status="error">
        <zw-avatar-fallback>ZW</zw-avatar-fallback>
      </zw-avatar>
      <div>
        <strong>Zeus Web</strong>
        <p>Component platform</p>
      </div>
    </div>
    <div class="demo-row" aria-label="Avatar sizes">
      <zw-avatar size="sm" image-status="error">
        <zw-avatar-fallback>SM</zw-avatar-fallback>
      </zw-avatar>
      <zw-avatar size="md" shape="square" image-status="error">
        <zw-avatar-fallback>MD</zw-avatar-fallback>
      </zw-avatar>
      <zw-avatar size="lg" image-status="error">
        <zw-avatar-fallback>LG</zw-avatar-fallback>
      </zw-avatar>
    </div>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1.25rem;
}

.demo-profile,
.demo-row {
  display: flex;
  gap: 0.875rem;
  align-items: center;
}

.demo-profile p {
  margin: 0.125rem 0 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}
</style>
