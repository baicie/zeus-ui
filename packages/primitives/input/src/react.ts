import './wc'

export {
  type InputProps,
  inputTagName,
  type InputType,
  type InputValueChangeDetail,
} from './index'

// Phase 0 does not enforce React dependency; exports types and wc registration.
// Phase 3 will implement the full React wrapper.
export const Input = 'zw-input'
