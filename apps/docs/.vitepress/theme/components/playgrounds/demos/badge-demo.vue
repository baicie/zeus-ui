<template>
  <div class="primitive-demo" data-playground-demo="badge">
    <zw-badge variant="default">Default</zw-badge>
    <zw-badge variant="secondary">Beta</zw-badge>
    <zw-badge variant="outline">Draft</zw-badge>
    <zw-badge variant="success">Healthy</zw-badge>
    <zw-badge variant="warning">Degraded</zw-badge>
    <zw-badge variant="danger">Failed</zw-badge>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}
</style>
