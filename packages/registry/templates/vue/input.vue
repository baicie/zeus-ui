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
  sm: '[&_[part=root]]:h-8 [&_[part=root]]:px-2.5 [&_[part=root]]:text-xs',
  md: '[&_[part=root]]:h-9 [&_[part=root]]:px-3 [&_[part=root]]:text-sm',
  lg: '[&_[part=root]]:h-10 [&_[part=root]]:px-3.5 [&_[part=root]]:text-sm',
}

const classes = computed(() =>
  cn(
    'block w-full',
    '[&_[part=root]]:flex [&_[part=root]]:w-full [&_[part=root]]:min-w-0 [&_[part=root]]:items-center [&_[part=root]]:rounded-[var(--zeus-radius-md)] [&_[part=root]]:border [&_[part=root]]:border-[hsl(var(--zeus-input))] [&_[part=root]]:bg-[hsl(var(--zeus-background))] [&_[part=root]]:text-[hsl(var(--zeus-foreground))]',
    '[&_[data-slot=input]]:min-w-0 [&_[data-slot=input]]:flex-1 [&_[data-slot=input]]:border-0 [&_[data-slot=input]]:bg-transparent [&_[data-slot=input]]:outline-none [&_[data-slot=input]]:placeholder:text-[hsl(var(--zeus-muted-foreground))]',
    '[&_[part=root]:focus-within]:outline-none [&_[part=root]:focus-within]:ring-2 [&_[part=root]:focus-within]:ring-[hsl(var(--zeus-ring)/0.35)]',
    '[&[data-invalid]_[part=root]]:border-[hsl(var(--zeus-destructive))] [&[data-invalid]_[part=root]:focus-within]:ring-[hsl(var(--zeus-destructive)/0.35)]',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
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
