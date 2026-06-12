<script setup lang="ts">
import { Input as InputPrimitive } from '@zeus-web/input/vue'
import { computed, useAttrs } from 'vue'

import { cn } from '@/lib/cn'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    size?: InputSize
    class?: string
    disabled?: boolean
    invalid?: boolean
    placeholder?: string
    modelValue?: string
  }>(),
  {
    size: 'md',
    class: '',
    disabled: false,
    invalid: false,
    placeholder: undefined,
    modelValue: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

type InputSize = 'sm' | 'md' | 'lg'

const attrs = useAttrs()

const inputSizeClasses: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 text-xs',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-3.5 text-sm',
}

const classes = computed(() =>
  cn(
    'flex w-full min-w-0 rounded-[var(--zeus-radius-md)] border border-[hsl(var(--zeus-input))] bg-[hsl(var(--zeus-background))] text-[hsl(var(--zeus-foreground))]',
    'placeholder:text-[hsl(var(--zeus-muted-foreground))]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--zeus-ring)/0.35)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
    props.invalid
    && 'border-[hsl(var(--zeus-destructive))] ring-2 ring-[hsl(var(--zeus-destructive)/0.35)]',
    inputSizeClasses[props.size],
    props.class,
  ),
)

const mergedAttrs = computed(() => {
  const result: Record<string, unknown> = { ...attrs }
  if (props.modelValue !== undefined) {
    result.value = props.modelValue
  }
  return result
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  emit('update:modelValue', target?.value ?? '')
}
</script>

<template>
  <InputPrimitive
    v-bind="mergedAttrs"
    :size="size"
    :disabled="disabled"
    :invalid="invalid"
    :placeholder="placeholder"
    :class="classes"
    @input="handleInput"
  />
</template>
