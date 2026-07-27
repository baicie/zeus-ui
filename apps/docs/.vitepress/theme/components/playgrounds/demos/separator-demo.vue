<template>
  <div class="primitive-demo" data-playground-demo="separator">
    <section>
      <strong>Account</strong>
      <p>Manage your profile and preferences.</p>
    </section>
    <zw-separator orientation="horizontal" />
    <div class="demo-toolbar">
      <span>Overview</span>
      <zw-separator orientation="vertical" :decorative="false" />
      <span>Activity</span>
      <zw-separator orientation="vertical" :decorative="false" />
      <span>Settings</span>
    </div>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: grid;
  gap: 1rem;
}

.primitive-demo p {
  margin: 0.25rem 0 0;
  color: var(--vp-c-text-2);
}

zw-separator {
  background: var(--vp-c-divider);
}

zw-separator[orientation='horizontal'] {
  width: 100%;
  height: 1px;
}

.demo-toolbar {
  display: flex;
  gap: 0.875rem;
  align-items: center;
}

.demo-toolbar zw-separator {
  flex: 0 0 1px;
  width: 1px;
  height: 1.5rem;
}
</style>
