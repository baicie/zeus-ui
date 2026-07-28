<template>
  <div class="primitive-demo" data-playground-demo="skeleton">
    <zw-skeleton class="demo-avatar" variant="circle" animated />
    <div class="demo-copy">
      <zw-skeleton class="demo-heading" variant="text" animated />
      <zw-skeleton class="demo-line" variant="text" animated />
      <zw-skeleton class="demo-line demo-line--short" variant="text" animated />
    </div>
  </div>
</template>

<style scoped>
.primitive-demo {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  max-width: 32rem;
}

zw-skeleton {
  overflow: hidden;
}

.demo-avatar {
  flex: 0 0 3rem;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
}

.demo-copy {
  display: grid;
  flex: 1;
  gap: 0.625rem;
}

.demo-heading,
.demo-line {
  display: block;
  width: 100%;
  height: 0.875rem;
}

.demo-heading {
  width: 45%;
  height: 1.125rem;
}

.demo-line--short {
  width: 72%;
}
</style>
