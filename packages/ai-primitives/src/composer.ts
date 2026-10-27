/**
 * `AiComposer` and `AiAttachmentTray` parts (AI2-206).
 *
 * The parts only express intent: typing calls `setText`, Enter is resolved
 * by the controller's key policy (IME composition and an open suggestion
 * menu win over sending), and the submit button calls `submit`. No LLM SDK,
 * no network.
 */

import type {
  ComposerAttachment,
  ComposerController,
  ComposerViewState,
} from '@zeus-web/ai-core'
import type { AiLocale } from './locale'
import type { IdScope, PartEvent, PartProps } from './parts'

import { EN_LOCALE } from './locale'
import { ariaBool, part } from './parts'

export interface ComposerPartsOptions {
  ids: IdScope
  locale?: AiLocale
  /** Accessible name when no visible label exists. */
  label?: string
  /** Lets an open @ / slash menu own Enter and arrows first. */
  menuOpen?: () => boolean
  /** Hand keys to an open menu; return true when it handled the key. */
  onMenuKey?: (event: PartEvent) => boolean
  disabled?: boolean
}

export interface ComposerParts {
  root: PartProps
  textarea: PartProps
  submit: PartProps
  /** Live error / blocked explanation; `text` is empty when there is none. */
  status: PartProps
}

export function getComposerParts(
  view: Readonly<ComposerViewState>,
  controller: Pick<
    ComposerController,
    'setText' | 'setComposing' | 'resolveKey' | 'submit'
  >,
  options: ComposerPartsOptions,
): ComposerParts {
  const locale = options.locale ?? EN_LOCALE
  const statusId = options.ids.id('composer-status')
  const disabled = options.disabled === true
  const message = view.lastError
    ? view.lastError
    : view.blockedReason && view.blockedReason !== 'empty'
      ? (locale.composerBlocked[view.blockedReason] ?? '')
      : ''

  return {
    root: part({
      'data-state': view.phase,
      'data-disabled': disabled ? '' : undefined,
      'aria-busy': ariaBool(view.phase === 'submitting'),
    }),
    textarea: part(
      {
        value: view.text,
        'aria-label': options.label ?? locale.composerLabel,
        'aria-describedby': message ? statusId : undefined,
        'aria-invalid': ariaBool(view.phase === 'rejected'),
        disabled,
        rows: 1,
      },
      {
        input: event => controller.setText(event.value ?? ''),
        compositionstart: () => controller.setComposing(true),
        compositionend: event => {
          controller.setComposing(false)
          // Some engines skip the final input event after composition.
          if (event.value !== undefined) controller.setText(event.value)
        },
        keydown: event => {
          if (event.isComposing) return
          if (options.menuOpen?.() && options.onMenuKey?.(event)) {
            event.preventDefault()
            return
          }
          const action = controller.resolveKey({
            key: event.key ?? '',
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            altKey: event.altKey,
            isComposing: event.isComposing,
            menuOpen: options.menuOpen?.(),
          })
          if (action === 'submit') {
            event.preventDefault()
            void controller.submit().catch(() => {})
          }
        },
      },
    ),
    submit: part(
      {
        type: 'button',
        disabled: disabled || view.blockedReason !== undefined,
        'aria-label':
          view.phase === 'submitting' ? locale.sending : locale.send,
        'aria-describedby': message ? statusId : undefined,
      },
      {
        click: () => {
          void controller.submit().catch(() => {})
        },
      },
      view.phase === 'submitting' ? locale.sending : locale.send,
    ),
    status: part(
      {
        id: statusId,
        role: view.lastError ? 'alert' : 'status',
        'aria-live': 'polite',
      },
      undefined,
      message,
    ),
  }
}

export interface AttachmentParts {
  item: PartProps
  name: PartProps
  progress?: PartProps
  remove: PartProps
}

export function getAttachmentTrayParts(
  attachments: readonly ComposerAttachment[],
  controller: Pick<ComposerController, 'removeAttachment'>,
  options: { ids: IdScope; locale?: AiLocale },
): { root: PartProps; items: AttachmentParts[] } {
  const locale = options.locale ?? EN_LOCALE

  return {
    root: part({ role: 'list', 'aria-label': 'Attachments' }),
    items: attachments.map(attachment => {
      const nameId = options.ids.id(`attachment-${attachment.id}`)
      return {
        item: part({
          role: 'listitem',
          'data-status': attachment.status,
          'aria-labelledby': nameId,
          'aria-invalid': ariaBool(attachment.status === 'failed'),
        }),
        name: part({ id: nameId }, undefined, attachment.name),
        progress:
          attachment.status === 'uploading'
            ? part({
                role: 'progressbar',
                'aria-label': locale.uploading(attachment.name),
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow':
                  attachment.progress === undefined
                    ? undefined
                    : Math.round(attachment.progress * 100),
              })
            : undefined,
        remove: part(
          {
            type: 'button',
            'aria-label': locale.removeAttachment(attachment.name),
          },
          { click: () => controller.removeAttachment(attachment.id) },
          '×',
        ),
      }
    }),
  }
}
