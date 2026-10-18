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
