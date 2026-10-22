# Registry Component Schema

此文件由 `components.json` 生成。公共 Props、事件和 Slot 只在 schema 中维护。

## button

Styled button component built on top of the button primitive.

Primitive: `@zeus-web/button`

| Kind  | Name        | Type / Values                                                                  | Default   | Framework  | Description                         |
| ----- | ----------- | ------------------------------------------------------------------------------ | --------- | ---------- | ----------------------------------- |
| Prop  | `variant`   | ButtonVariant: `default`, `primary`, `secondary`, `outline`, `ghost`, `danger` | `default` | react, vue | Visual style variant.               |
| Prop  | `size`      | ButtonSize: `sm`, `md`, `lg`, `icon`                                           | `md`      | react, vue | Control size.                       |
| Prop  | `type`      | ButtonType: `button`, `submit`, `reset`                                        | `button`  | react, vue | Native button type.                 |
| Prop  | `className` | `string`                                                                       | -         | react      | Additional React class name.        |
| Prop  | `class`     | `string`                                                                       | -         | vue        | Additional Vue class name.          |
| Prop  | `ariaLabel` | `string`                                                                       | -         | react, vue | Accessible label for the button.    |
| Prop  | `disabled`  | `boolean`                                                                      | `false`   | react, vue | Whether the button is disabled.     |
| Prop  | `loading`   | `boolean`                                                                      | `false`   | react, vue | Whether the button is loading.      |
| Prop  | `name`      | `string`                                                                       | -         | react, vue | Native button name.                 |
| Prop  | `pressed`   | `boolean`                                                                      | `false`   | react, vue | Whether the button is pressed.      |
| Prop  | `value`     | `string`                                                                       | -         | react, vue | Native button value.                |
| Event | `press`     | `CustomEvent<{ nativeEvent: MouseEvent }>`                                     | -         | react, vue | Emitted when the button is pressed. |
| Slot  | `prefix`    | react: `ReactNode`; vue: `() => unknown`                                       | -         | react, vue | Content before the button label.    |
| Slot  | `default`   | react: `ReactNode`; vue: `() => unknown`                                       | -         | react, vue | Button content.                     |
| Slot  | `suffix`    | react: `ReactNode`; vue: `() => unknown`                                       | -         | react, vue | Content after the button label.     |

## input

Styled input component built on top of the input primitive.

Primitive: `@zeus-web/input`

| Kind  | Name                | Type / Values                                                            | Default | Framework  | Description                             |
| ----- | ------------------- | ------------------------------------------------------------------------ | ------- | ---------- | --------------------------------------- |
| Prop  | `size`              | InputSize: `sm`, `md`, `lg`                                              | `md`    | react, vue | Control size.                           |
| Prop  | `type`              | InputType: `text`, `email`, `password`, `search`, `tel`, `url`, `number` | `text`  | react, vue | Native input type.                      |
| Prop  | `className`         | `string`                                                                 | -       | react      | Additional React class name.            |
| Prop  | `class`             | `string`                                                                 | -       | vue        | Additional Vue class name.              |
| Prop  | `id`                | `string`                                                                 | -       | react, vue | Native input id.                        |
| Prop  | `value`             | `string`                                                                 | -       | react, vue | Controlled input value.                 |
| Prop  | `defaultValue`      | `string`                                                                 | -       | react, vue | Initial uncontrolled input value.       |
| Prop  | `placeholder`       | `string`                                                                 | -       | react, vue | Placeholder text.                       |
| Prop  | `disabled`          | `boolean`                                                                | `false` | react, vue | Whether the input is disabled.          |
| Prop  | `invalid`           | `boolean`                                                                | `false` | react, vue | Whether the input has an invalid value. |
| Prop  | `readonly`          | `boolean`                                                                | `false` | react, vue | Whether the input is read-only.         |
| Prop  | `required`          | `boolean`                                                                | `false` | react, vue | Whether the input is required.          |
| Prop  | `name`              | `string`                                                                 | -       | react, vue | Native input name.                      |
| Prop  | `autocomplete`      | `string`                                                                 | -       | react, vue | Native autocomplete hint.               |
| Prop  | `ariaLabel`         | `string`                                                                 | -       | react, vue | Accessible label for the input.         |
| Prop  | `ariaDescribedby`   | `string`                                                                 | -       | react, vue | Accessible description reference.       |
| Prop  | `ariaErrormessage`  | `string`                                                                 | -       | react, vue | Accessible error message reference.     |
| Prop  | `formatter`         | `(value: string) => string`                                              | -       | react, vue | Optional input value formatter.         |
| Prop  | `modelValue`        | `string`                                                                 | -       | vue        | Controlled input value.                 |
| Event | `value-change`      | `CustomEvent<{ value: string; nativeEvent: Event }>`                     | -       | react, vue | Emitted when the input value changes.   |
| Event | `focus-change`      | `CustomEvent<{ focused: boolean; nativeEvent: FocusEvent }>`             | -       | react, vue | Emitted when the input focus changes.   |
| Event | `update:modelValue` | `string`                                                                 | -       | vue        | Vue model update event.                 |
| Slot  | `prefix`            | react: `ReactNode`; vue: `() => unknown`                                 | -       | react, vue | Content before the input control.       |
| Slot  | `suffix`            | react: `ReactNode`; vue: `() => unknown`                                 | -       | react, vue | Content after the input control.        |
| Slot  | `message`           | react: `ReactNode`; vue: `() => unknown`                                 | -       | react, vue | Validation or help message content.     |

## form-field

Styled form field relationship built on the form-field primitive.

Primitive: `@zeus-web/form-field`

| Kind | Name        | Type / Values                            | Default | Framework  | Description                                                                           |
| ---- | ----------- | ---------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------------- |
| Prop | `id`        | `string`                                 | -       | react, vue | Stable field identifier.                                                              |
| Prop | `invalid`   | `boolean`                                | `false` | react, vue | Marks the field as invalid.                                                           |
| Prop | `disabled`  | `boolean`                                | `false` | react, vue | Disables the associated control.                                                      |
| Prop | `required`  | `boolean`                                | `false` | react, vue | Marks the associated control as required.                                             |
| Prop | `className` | `string`                                 | -       | react      | Additional React class name.                                                          |
| Prop | `class`     | `string`                                 | -       | vue        | Additional Vue class name.                                                            |
| Slot | `default`   | react: `ReactNode`; vue: `() => unknown` | -       | react, vue | FormFieldLabel, FormFieldDescription, FormFieldControl and FormFieldMessage children. |

## popover

Styled popover built on the popover primitive.

Primitive: `@zeus-web/popover`

| Kind  | Name          | Type / Values                                         | Default | Framework  | Description                                  |
| ----- | ------------- | ----------------------------------------------------- | ------- | ---------- | -------------------------------------------- |
| Prop  | `open`        | `boolean`                                             | -       | react, vue | Controlled open state.                       |
| Prop  | `defaultOpen` | `boolean`                                             | `false` | react, vue | Initial uncontrolled open state.             |
| Prop  | `modal`       | `boolean`                                             | `true`  | react, vue | Dismisses on outside pointer input.          |
| Prop  | `disabled`    | `boolean`                                             | `false` | react, vue | Disables the trigger.                        |
| Prop  | `className`   | `string`                                              | -       | react      | Additional React class name.                 |
| Prop  | `class`       | `string`                                              | -       | vue        | Additional Vue class name.                   |
| Event | `open-change` | `CustomEvent<{ open: boolean; nativeEvent?: Event }>` | -       | react, vue | Emitted when the popover open state changes. |
| Slot  | `default`     | react: `ReactNode`; vue: `() => unknown`              | -       | react, vue | PopoverTrigger and PopoverContent children.  |

## dropdown-menu

Styled dropdown menu built on the dropdown-menu primitive.

Primitive: `@zeus-web/dropdown-menu`

| Kind  | Name          | Type / Values                                         | Default | Framework  | Description                                                             |
| ----- | ------------- | ----------------------------------------------------- | ------- | ---------- | ----------------------------------------------------------------------- |
| Prop  | `open`        | `boolean`                                             | -       | react, vue | Controlled open state.                                                  |
| Prop  | `defaultOpen` | `boolean`                                             | `false` | react, vue | Initial uncontrolled open state.                                        |
| Prop  | `disabled`    | `boolean`                                             | `false` | react, vue | Disables the trigger and items.                                         |
| Prop  | `className`   | `string`                                              | -       | react      | Additional React class name.                                            |
| Prop  | `class`       | `string`                                              | -       | vue        | Additional Vue class name.                                              |
| Event | `open-change` | `CustomEvent<{ open: boolean; nativeEvent?: Event }>` | -       | react, vue | Emitted when the menu open state changes.                               |
| Event | `select`      | `CustomEvent<{ value?: string; nativeEvent: Event }>` | -       | react, vue | Emitted when an enabled menu item is selected.                          |
| Slot  | `default`     | react: `ReactNode`; vue: `() => unknown`              | -       | react, vue | DropdownMenuTrigger, DropdownMenuContent and DropdownMenuItem children. |

## toast

Styled live-region toast built on the toast primitive.

Primitive: `@zeus-web/toast`

| Kind  | Name          | Type / Values                                         | Default      | Framework  | Description                                              |
| ----- | ------------- | ----------------------------------------------------- | ------------ | ---------- | -------------------------------------------------------- |
| Prop  | `open`        | `boolean`                                             | -            | react, vue | Controlled open state.                                   |
| Prop  | `defaultOpen` | `boolean`                                             | `false`      | react, vue | Initial uncontrolled open state.                         |
| Prop  | `duration`    | `number`                                              | `5000`       | react, vue | Auto-dismiss duration in milliseconds; zero disables it. |
| Prop  | `status`      | ToastStatus: `foreground`, `background`               | `foreground` | react, vue | Live-region announcement priority.                       |
| Prop  | `className`   | `string`                                              | -            | react      | Additional React class name.                             |
| Prop  | `class`       | `string`                                              | -            | vue        | Additional Vue class name.                               |
| Event | `open-change` | `CustomEvent<{ open: boolean; nativeEvent?: Event }>` | -            | react, vue | Emitted when the toast open state changes.               |
| Slot  | `default`     | react: `ReactNode`; vue: `() => unknown`              | -            | react, vue | ToastTitle, ToastDescription and ToastClose children.    |
