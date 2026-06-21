<script setup lang="ts">
import {
  ChatComposer as ChatComposerPrimitive,
  Chat as ChatPrimitive,
  ChatThread as ChatThreadPrimitive,
} from '@zeus-web/chat/vue'
import { computed } from 'vue'

import { cn } from '@/lib/cn'

const props = withDefaults(
  defineProps<{
    class?: string
  }>(),
  {
    class: '',
  },
)

const chatClasses = computed(() =>
  cn(
    'flex h-full w-full flex-col overflow-hidden rounded-[var(--zeus-radius-lg)] border border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))]',
    props.class,
  ),
)
</script>

<template>
  <ChatPrimitive :class="chatClasses">
    <template #thread>
      <ChatThreadPrimitive
        :class="
          cn(
            'flex-1 overflow-y-auto p-4 [&_[data-slot=chat-message-root]+[data-slot=chat-message-root]]:mt-3',
          )
        "
      >
        <slot name="thread" />
      </ChatThreadPrimitive>
    </template>

    <template #composer>
      <ChatComposerPrimitive
        :class="
          cn(
            'border-t border-[hsl(var(--zeus-border))] bg-[hsl(var(--zeus-background))] p-3',
          )
        "
      >
        <slot name="composer" />
      </ChatComposerPrimitive>
    </template>

    <template #default>
      <slot />
    </template>
  </ChatPrimitive>
</template>
