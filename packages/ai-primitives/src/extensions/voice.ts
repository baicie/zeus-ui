/**
 * `AiVoiceInput` and `AiAudioPlayback` (AI2-512).
 *
 * No speech or audio SDK is bundled: the application injects a recognizer
 * (Web Speech API, a cloud service, a native bridge) and a player. These
 * controllers only own the state machine, permission errors and the
 * accessible controls; recognized text goes into the composer as a normal
 * edit, never as a submit.
 */

import type { ComposerController, Controller } from '@zeus-web/ai-core'
import type { PartProps } from '../parts'

import { createViewStore } from '@zeus-web/ai-core'
import { ariaBool, part } from '../parts'

export interface SpeechRecognizer {
  /** Start listening; call `onText` with interim/final text, resolve when stopped. */
  start: (handlers: {
    onText: (text: string, final: boolean) => void
    onError: (error: {
      code: 'not-allowed' | 'no-speech' | 'network' | 'unavailable'
      message: string
    }) => void
    onEnd: () => void
  }) => void
  stop: () => void
}

export type VoiceState = 'idle' | 'listening' | 'error' | 'unavailable'

export interface VoiceInputViewState {
  state: VoiceState
  interim: string
  error?: string
  errorCode?: string
}

export interface VoiceInputController extends Controller<VoiceInputViewState> {
  toggle: () => void
}

export function createVoiceInput(options: {
  recognizer?: SpeechRecognizer
  composer: Pick<ComposerController, 'getSnapshot' | 'setText'>
}): VoiceInputController {
  const view = createViewStore<VoiceInputViewState>({
    state: options.recognizer ? 'idle' : 'unavailable',
    interim: '',
  })
  let baseText = ''

  function stop(): void {
    options.recognizer?.stop()
  }

  view.onDispose(() => {
    if (view.getSnapshot().state === 'listening') stop()
  })

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    toggle(): void {
      const recognizer = options.recognizer
      if (!recognizer) return

      if (view.getSnapshot().state === 'listening') {
        stop()
        return
      }

      baseText = options.composer.getSnapshot().text
      view.update({
        state: 'listening',
        interim: '',
        error: undefined,
        errorCode: undefined,
      })
      recognizer.start({
        onText: (text, final) => {
          if (final) {
            const separator = baseText && !/\s$/.test(baseText) ? ' ' : ''
            baseText = `${baseText}${separator}${text}`
            options.composer.setText(baseText)
            view.update({ interim: '' })
          } else {
            view.update({ interim: text })
          }
        },
        onError: error =>
          view.update({
            state: 'error',
            error: error.message,
            errorCode: error.code,
            interim: '',
          }),
        onEnd: () => {
          if (view.getSnapshot().state === 'listening')
            view.update({ state: 'idle', interim: '' })
        },
      })
    },
    dispose(): void {
      view.dispose()
    },
  }
}

export function getVoiceInputParts(
  view: Readonly<VoiceInputViewState>,
  controller: Pick<VoiceInputController, 'toggle'>,
  labels: { start: string; stop: string; unavailable: string } = {
    start: 'Start voice input',
    stop: 'Stop voice input',
    unavailable: 'Voice input is not available',
  },
): { button: PartProps; status: PartProps } {
  const listening = view.state === 'listening'
  return {
    button: part(
      {
        type: 'button',
        'aria-pressed': ariaBool(listening),
        disabled: view.state === 'unavailable',
        'aria-label':
          view.state === 'unavailable'
            ? labels.unavailable
            : listening
              ? labels.stop
              : labels.start,
      },
      { click: () => controller.toggle() },
    ),
    status: part(
      { role: view.error ? 'alert' : 'status', 'aria-live': 'polite' },
      undefined,
      view.error ?? view.interim,
    ),
  }
}

export interface AudioPlayer {
  play: () => Promise<void>
  pause: () => void
  /** Subscribe to `ended`; returns an unsubscribe. */
  onEnded: (listener: () => void) => () => void
}

export interface AudioPlaybackViewState {
  playing: boolean
  error?: string
}

export function createAudioPlayback(
  player: AudioPlayer,
): Controller<AudioPlaybackViewState> & {
  toggle: () => Promise<void>
} {
  const view = createViewStore<AudioPlaybackViewState>({ playing: false })
  view.onDispose(player.onEnded(() => view.update({ playing: false })))
  view.onDispose(() => player.pause())

  return {
    getSnapshot: view.getSnapshot,
    subscribe: view.subscribe,
    get disposed(): boolean {
      return view.disposed
    },
    async toggle(): Promise<void> {
      if (view.getSnapshot().playing) {
        player.pause()
        view.update({ playing: false })
        return
      }
      try {
        // Autoplay policies reject play() without a user gesture.
        await player.play()
        view.update({ playing: true, error: undefined })
      } catch (error) {
        view.update({
          playing: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
    dispose(): void {
      view.dispose()
    },
  }
}
