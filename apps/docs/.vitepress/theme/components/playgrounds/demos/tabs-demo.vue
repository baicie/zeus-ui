<template>
  <div class="primitive-demo" data-playground-demo="tabs">
    <zw-tabs default-value="overview">
      <zw-tabs-list>
        <zw-tabs-trigger value="overview">Overview</zw-tabs-trigger>
        <zw-tabs-trigger value="activity">Activity</zw-tabs-trigger>
        <zw-tabs-trigger value="settings">Settings</zw-tabs-trigger>
      </zw-tabs-list>
      <zw-tabs-content value="overview">
        <p>Review the current workspace summary.</p>
      </zw-tabs-content>
      <zw-tabs-content value="activity">
        <p>Inspect recent component activity.</p>
      </zw-tabs-content>
      <zw-tabs-content value="settings">
        <p>Configure the playground experience.</p>
      </zw-tabs-content>
    </zw-tabs>
  </div>
</template>

<style scoped>
.primitive-demo {
  min-height: 9rem;
}

.primitive-demo p {
  margin: 0;
  color: var(--vp-c-text-2);
}
</style>
