import { aiMetadata } from '../src'

describe('select AI metadata', () => {
  const select = aiMetadata.components.find(
    component => component.name === 'select',
  )
  if (!select) throw new Error('select AI metadata is required')

  it('documents the public selection, form, and accessibility props', () => {
    const propNames = select.props.map(prop => prop.name)
    expect(propNames).toEqual(
      expect.arrayContaining([
        'id',
        'value',
        'defaultValue',
        'values',
        'defaultValues',
        'placeholder',
        'size',
        'multiple',
        'disabled',
        'required',
        'invalid',
        'name',
        'ariaLabel',
        'ariaLabelledby',
        'ariaDescribedby',
        'ariaErrormessage',
      ]),
    )
    expect(propNames).not.toContain('open')

    expect(select.props.find(prop => prop.name === 'values')).toMatchObject({
      type: 'string[]',
    })
    expect(select.props.find(prop => prop.name === 'id')).toEqual({
      name: 'id',
      type: 'string',
      description:
        'Base ID used to derive the internal trigger ID; the listbox keeps its generated ID.',
    })
    expect(
      select.props.find(prop => prop.name === 'defaultValues'),
    ).toMatchObject({ type: 'string[]' })
    expect(select.props.find(prop => prop.name === 'multiple')).toMatchObject({
      type: 'boolean',
    })
    expect(select.props.find(prop => prop.name === 'required')).toMatchObject({
      type: 'boolean',
    })
    expect(select.props.find(prop => prop.name === 'disabled')).toMatchObject({
      type: 'boolean',
    })
  })

  it('documents value-change and focus-change event details', () => {
    expect(select.events.find(event => event.name === 'value-change')).toEqual({
      name: 'value-change',
      reactName: 'onValueChange',
      description: 'Emitted when selected value changes.',
      detail: {
        value: 'string',
        values: 'string[]',
        nativeEvent: 'Event',
      },
    })
    expect(select.events.find(event => event.name === 'focus-change')).toEqual({
      name: 'focus-change',
      reactName: 'onFocusChange',
      description: 'Emitted when focus enters or leaves the select trigger.',
      detail: {
        focused: 'boolean',
        nativeEvent: 'FocusEvent',
      },
    })
  })
})
