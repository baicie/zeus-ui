import './wc'

export {
  type InputProps,
  inputTagName,
  type InputType,
  type InputValueChangeDetail,
} from './index'

// Phase 0 does not enforce Vue dependency; exports types and wc registration.
// Phase 3 will implement the full Vue wrapper.
export const ZInput = 'zw-input'
