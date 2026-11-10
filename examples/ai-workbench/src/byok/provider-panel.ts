/* eslint-disable no-restricted-globals, no-alert */
/**
 * Settings → Model providers.
 *
 * One panel that manages provider profiles and the vault that protects their
 * keys. The layout answers three questions in order: what is configured, is it
 * reachable, and is the vault open.
 *
 * Security notes surfaced in the UI itself, because a feature like this is only
 * safe if the person using it understands what it does not protect:
 * - the vault protects data at rest, not a compromised page
 * - the key goes to the gateway you configured, and nowhere else
 * - a proxy you run can see the key in transit
 */

import type { ConnectionCheck } from './gateway'
import type { ProviderProfile } from './profiles'
import type { VaultState } from './vault'
import { GatewayError, listModels, testConnection } from './gateway'
import {
  createProfile,
  DEFAULT_CHAT_PATH,
  keyRecordId,
  providerStore,
} from './profiles'
import { vault } from './vault'

export interface ProviderPanelOptions {
  readonly root: HTMLElement
}

type KeyPresence = 'none' | 'saved' | 'unreadable'

export function mountProviderPanel(options: ProviderPanelOptions): () => void {
  const { root } = options
  root.classList.add('providers')

  const heading = document.createElement('div')
  heading.className = 'providers-head'
  const title = document.createElement('h2')
  title.textContent = 'Model providers'
  const description = document.createElement('p')
  description.className = 'providers-description'
  description.textContent =
    'Bring your own gateway. Keys are encrypted in this browser and never sent to the Zeus Host.'
  heading.append(title, description)

  const vaultBar = document.createElement('div')
  vaultBar.className = 'vault-bar'
  vaultBar.dataset.testid = 'vault-bar'

  const layout = document.createElement('div')
  layout.className = 'providers-layout'
  const list = document.createElement('div')
  list.className = 'provider-list'
  list.dataset.testid = 'provider-list'
  const detail = document.createElement('div')
  detail.className = 'provider-detail'
  detail.dataset.testid = 'provider-detail'
  layout.append(list, detail)

  const notice = document.createElement('p')
  notice.className = 'providers-notice'
  notice.textContent =
    'Encryption protects keys stored on this device. It cannot protect a key from malicious script running on this page while the vault is unlocked.'

  root.append(heading, vaultBar, layout, notice)

  let selectedId: string | undefined
  let vaultState: VaultState = { status: 'empty', initialized: false }
  const unsubscribeVault = vault.subscribe(state => {
    vaultState = state
    renderVaultBar()
    renderDetail()
  })

  const unsubscribeProfiles = providerStore.subscribe(() => {
    if (!selectedId)
      selectedId = providerStore.activeIdValue() ?? providerStore.list()[0]?.id
    renderList()
    renderDetail()
  })

  void vault.refresh().then(state => {
    vaultState = state
    renderVaultBar()
    renderDetail()
  })
  void providerStore.load()

  /* ------------------------------------------------------------- vault UI */

  function renderVaultBar(): void {
    vaultBar.replaceChildren()
    const state = document.createElement('span')
    state.className = 'vault-state'
    state.dataset.testid = 'vault-state'
    state.dataset.status = vaultState.status
    state.textContent =
      vaultState.status === 'unlocked'
        ? 'Vault unlocked'
        : vaultState.status === 'locked'
          ? 'Vault locked'
          : 'No vault yet'

    const actions = document.createElement('div')
    actions.className = 'vault-actions'

    if (vaultState.status === 'empty') {
      const setup = document.createElement('button')
      setup.type = 'button'
      setup.className = 'btn btn-primary'
      setup.dataset.testid = 'vault-setup'
      setup.textContent = 'Create vault'
      setup.addEventListener('click', () => promptSetup())
      actions.append(setup)
    } else if (vaultState.status === 'locked') {
      const unlock = document.createElement('button')
      unlock.type = 'button'
      unlock.className = 'btn btn-primary'
      unlock.dataset.testid = 'vault-unlock'
      unlock.textContent = 'Unlock'
      unlock.addEventListener('click', () => promptUnlock())
      actions.append(unlock)
    } else {
      const lock = document.createElement('button')
      lock.type = 'button'
      lock.className = 'btn'
      lock.dataset.testid = 'vault-lock'
      lock.textContent = 'Lock'
      lock.addEventListener('click', () => vault.lock())
      const change = document.createElement('button')
      change.type = 'button'
      change.className = 'btn'
      change.dataset.testid = 'vault-change'
      change.textContent = 'Change passphrase'
      change.addEventListener('click', () => promptChange())
      const reset = document.createElement('button')
      reset.type = 'button'
      reset.className = 'btn btn-danger'
      reset.dataset.testid = 'vault-destroy'
      reset.textContent = 'Delete vault'
      reset.addEventListener('click', () => promptDestroy())
      actions.append(lock, change, reset)
    }

    vaultBar.append(state, actions)
  }

  /** A small inline form; no browser prompt, so the passphrase is masked. */
  function promptForm(config: {
    title: string
    fields: Array<{ name: string; label: string }>
    submitLabel: string
    onSubmit: (values: Record<string, string>) => Promise<void>
  }): void {
    const existing = root.querySelector('.vault-form')
    existing?.remove()
    const form = document.createElement('form')
    form.className = 'vault-form'
    form.dataset.testid = 'vault-form'
    const legend = document.createElement('p')
    legend.className = 'vault-form-title'
    legend.textContent = config.title
    form.append(legend)

    const inputs: Record<string, HTMLInputElement> = {}
    for (const field of config.fields) {
      const label = document.createElement('label')
      label.className = 'field-label'
      label.textContent = field.label
      const input = document.createElement('input')
      input.className = 'input'
      input.type = 'password'
      input.autocomplete = 'current-password'
      input.required = true
      input.dataset.testid = `vault-field-${field.name}`
      label.append(input)
      form.append(label)
      inputs[field.name] = input
    }

    const error = document.createElement('p')
    error.className = 'vault-error'
    error.dataset.testid = 'vault-error'
    error.hidden = true

    const row = document.createElement('div')
    row.className = 'row'
    const submit = document.createElement('button')
    submit.type = 'submit'
    submit.className = 'btn btn-primary'
    submit.textContent = config.submitLabel
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = 'btn'
    cancel.textContent = 'Cancel'
    cancel.addEventListener('click', () => form.remove())
    row.append(submit, cancel)
    form.append(error, row)

    form.addEventListener('submit', event => {
      event.preventDefault()
      const values: Record<string, string> = {}
      for (const [name, input] of Object.entries(inputs))
        values[name] = input.value
      submit.disabled = true
      config
        .onSubmit(values)
        .then(() => {
          form.remove()
        })
        .catch((cause: unknown) => {
          error.hidden = false
          error.textContent =
            cause instanceof Error ? cause.message : String(cause)
        })
        .finally(() => {
          submit.disabled = false
          // Never keep the passphrase in the DOM longer than the submit.
          for (const input of Object.values(inputs)) input.value = ''
        })
    })

    vaultBar.after(form)
    inputs[config.fields[0]!.name]!.focus()
  }

  function promptSetup(): void {
    promptForm({
      title: 'Choose a vault passphrase',
      fields: [
        { name: 'passphrase', label: 'Passphrase' },
        { name: 'confirm', label: 'Confirm passphrase' },
      ],
      submitLabel: 'Create vault',
      onSubmit: async values => {
        if (values.passphrase !== values.confirm) {
          throw new Error('The two passphrases do not match.')
        }
        await vault.initialize(values.passphrase!)
      },
    })
  }

  function promptUnlock(): void {
    promptForm({
      title: 'Unlock the vault',
      fields: [{ name: 'passphrase', label: 'Passphrase' }],
      submitLabel: 'Unlock',
      onSubmit: async values => {
        await vault.unlock(values.passphrase!)
      },
    })
  }

  function promptChange(): void {
    promptForm({
      title: 'Change the vault passphrase',
      fields: [
        { name: 'current', label: 'Current passphrase' },
        { name: 'next', label: 'New passphrase' },
      ],
      submitLabel: 'Change passphrase',
      onSubmit: async values => {
        await vault.changePassphrase(values.current!, values.next!)
      },
    })
  }

  function promptDestroy(): void {
    const confirmed = window.confirm(
      'Delete the vault and every stored key? Conversations stay; keys cannot be recovered.',
    )
    if (!confirmed) return
    void vault.destroy()
  }

  /* -------------------------------------------------------------- list UI */

  function renderList(): void {
    list.replaceChildren()
    const header = document.createElement('div')
    header.className = 'provider-list-head'
    const label = document.createElement('span')
    label.className = 'side-section-title'
    label.textContent = 'Profiles'
    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'btn btn-sm'
    add.dataset.testid = 'provider-add'
    add.textContent = 'Add'
    add.addEventListener('click', () => {
      const profile = createProfile({ name: 'New provider' })
      void providerStore.save(profile).then(() => {
        selectedId = profile.id
        renderList()
        renderDetail()
      })
    })
    header.append(label, add)
    list.append(header)

    const profiles = providerStore.list()
    if (profiles.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'provider-empty'
      empty.textContent = 'No providers yet. Add one to start a BYOK chat.'
      list.append(empty)
      return
    }

    for (const profile of profiles) {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'provider-item'
      item.dataset.testid = `provider-item-${profile.id}`
      item.setAttribute('aria-current', String(profile.id === selectedId))
      const name = document.createElement('span')
      name.className = 'provider-item-name'
      name.textContent = profile.name || 'Untitled'
      const meta = document.createElement('span')
      meta.className = 'provider-item-meta'
      meta.textContent = `${profile.model || 'no model'}${profile.verifiedAt ? ' · verified' : ''}`
      item.append(name, meta)
      item.addEventListener('click', () => {
        selectedId = profile.id
        renderList()
        renderDetail()
      })
      list.append(item)
    }
  }

  /* ------------------------------------------------------------ detail UI */

  function renderDetail(): void {
    detail.replaceChildren()
    const selected = selectedId ? providerStore.get(selectedId) : undefined
    if (!selected) {
      const empty = document.createElement('p')
      empty.className = 'provider-empty'
      empty.textContent = 'Select or add a provider.'
      detail.append(empty)
      return
    }

    // Bind the narrowed value; `selectedId` can change between renders.
    const profile = selected

    const form = document.createElement('form')
    form.className = 'provider-form'
    form.dataset.testid = 'provider-form'

    const field = (
      name: string,
      label: string,
      value: string,
      options: {
        type?: string
        placeholder?: string
        hint?: string
        step?: string
        min?: string
        max?: string
      } = {},
    ): HTMLInputElement => {
      const wrapper = document.createElement('div')
      wrapper.className = 'field'
      const labelEl = document.createElement('label')
      labelEl.className = 'field-label'
      labelEl.textContent = label
      const input = document.createElement('input')
      input.className = 'input'
      input.type = options.type ?? 'text'
      input.value = value
      input.name = name
      input.dataset.testid = `provider-field-${name}`
      if (options.placeholder) input.placeholder = options.placeholder
      if (options.step) input.step = options.step
      if (options.min !== undefined) input.min = options.min
      if (options.max !== undefined) input.max = options.max
      labelEl.append(input)
      wrapper.append(labelEl)
      if (options.hint) {
        const hint = document.createElement('p')
        hint.className = 'field-hint'
        hint.textContent = options.hint
        wrapper.append(hint)
      }
      form.append(wrapper)
      return input
    }

    const nameInput = field('name', 'Profile name', profile.name)
    const baseInput = field('baseUrl', 'Base URL', profile.baseUrl, {
      placeholder: 'https://api.example.com/v1',
      hint: 'The gateway root. /chat/completions and /models are appended.',
    })
    const keyInput = field('apiKey', 'API key', '', {
      type: 'password',
      placeholder: 'Paste the key',
      hint:
        vaultState.status === 'unlocked'
          ? 'Stored encrypted. Leave blank to keep the saved key.'
          : 'Unlock the vault to change the saved key.',
    })
    keyInput.autocomplete = 'off'
    if (vaultState.status !== 'unlocked') keyInput.disabled = true

    const modelRow = document.createElement('div')
    modelRow.className = 'field'
    const modelLabel = document.createElement('label')
    modelLabel.className = 'field-label'
    modelLabel.textContent = 'Model'
    const modelInput = document.createElement('input')
    modelInput.className = 'input'
    modelInput.name = 'model'
    modelInput.value = profile.model
    modelInput.placeholder = 'gpt-4o-mini'
    modelInput.dataset.testid = 'provider-field-model'
    modelInput.setAttribute('list', 'provider-model-options')
    const modelList = document.createElement('datalist')
    modelList.id = 'provider-model-options'
    const loadModelsButton = document.createElement('button')
    loadModelsButton.type = 'button'
    loadModelsButton.className = 'btn btn-sm'
    loadModelsButton.dataset.testid = 'provider-load-models'
    loadModelsButton.textContent = 'Load models'
    modelLabel.append(modelInput)
    const modelHint = document.createElement('p')
    modelHint.className = 'field-hint'
    modelHint.dataset.testid = 'provider-model-hint'
    modelHint.textContent =
      'Load from the gateway, or type the model id if /models is unavailable.'
    modelRow.append(modelLabel, modelList, loadModelsButton, modelHint)
    form.append(modelRow)

    const advanced = document.createElement('div')
    advanced.className = 'field-row'
    form.append(advanced)
    const chatPathInput = field('chatPath', 'Chat path', profile.chatPath, {
      hint: `Default ${DEFAULT_CHAT_PATH}`,
    })
    const timeoutInput = field(
      'timeoutMs',
      'Timeout (ms)',
      String(profile.timeoutMs),
      {
        type: 'number',
        min: '1000',
        step: '1000',
      },
    )
    const temperatureInput = field(
      'temperature',
      'Temperature',
      String(profile.temperature),
      {
        type: 'number',
        step: '0.1',
        min: '0',
        max: '2',
      },
    )
    const maxTokensInput = field(
      'maxTokens',
      'Max output tokens',
      String(profile.maxTokens),
      {
        type: 'number',
        min: '1',
        step: '1',
      },
    )

    const streamRow = document.createElement('label')
    streamRow.className = 'checkbox-row'
    const streamInput = document.createElement('input')
    streamInput.type = 'checkbox'
    streamInput.checked = profile.stream
    streamInput.dataset.testid = 'provider-field-stream'
    const streamText = document.createElement('span')
    streamText.textContent = 'Stream responses'
    streamRow.append(streamInput, streamText)
    form.append(streamRow)

    const status = ensureStatus()
    const actions = document.createElement('div')
    actions.className = 'provider-actions'
    const save = document.createElement('button')
    save.type = 'submit'
    save.className = 'btn btn-primary'
    save.dataset.testid = 'provider-save'
    save.textContent = 'Save'
    const test = document.createElement('button')
    test.type = 'button'
    test.className = 'btn'
    test.dataset.testid = 'provider-test'
    test.textContent = 'Test connection'
    const activate = document.createElement('button')
    activate.type = 'button'
    activate.className = 'btn'
    activate.dataset.testid = 'provider-activate'
    activate.textContent =
      providerStore.activeIdValue() === profile.id ? 'Active' : 'Use for chat'
    activate.disabled = providerStore.activeIdValue() === profile.id
    activate.addEventListener('click', () => {
      void providerStore.setActive(profile.id)
    })
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'btn btn-danger'
    remove.dataset.testid = 'provider-delete'
    remove.textContent = 'Delete'
    remove.addEventListener('click', () => {
      if (!window.confirm('Delete this provider and its stored key?')) return
      void vault.delete(keyRecordId(profile.id)).catch(() => undefined)
      void providerStore.delete(profile.id).then(() => {
        selectedId = providerStore.list()[0]?.id
        renderList()
        renderDetail()
      })
    })
    actions.append(save, test, activate, remove)
    form.append(status, actions)

    const collect = (): ProviderProfile => ({
      ...profile,
      name: nameInput.value.trim(),
      baseUrl: baseInput.value.trim(),
      model: modelInput.value.trim(),
      chatPath: chatPathInput.value.trim() || DEFAULT_CHAT_PATH,
      timeoutMs: Math.max(1000, Number(timeoutInput.value) || 60_000),
      temperature: Math.min(
        2,
        Math.max(0, Number(temperatureInput.value) || 0),
      ),
      maxTokens: Math.max(1, Number(maxTokensInput.value) || 2048),
      stream: streamInput.checked,
    })

    form.addEventListener('submit', event => {
      event.preventDefault()
      void (async () => {
        const next = collect()
        await providerStore.save(next)
        const apiKey = keyInput.value.trim()
        if (apiKey) {
          if (vaultState.status !== 'unlocked') {
            showStatus(status, 'Unlock the vault before saving a key.', 'error')
            return
          }
          await vault.put(keyRecordId(next.id), apiKey)
          keyInput.value = ''
        }
        showStatus(status, 'Saved.', 'ok')
        renderList()
        void refreshKeyPresence()
      })().catch((cause: unknown) => {
        showStatus(status, errorText(cause), 'error')
      })
    })

    test.addEventListener('click', () => {
      void (async () => {
        const next = collect()
        await providerStore.save(next)
        await runConnectionTest(next, status)
      })().catch((cause: unknown) => {
        showStatus(status, errorText(cause), 'error')
      })
    })

    loadModelsButton.addEventListener('click', () => {
      void (async () => {
        const key = await resolveKey(profile.id, keyInput.value.trim())
        if (!key) {
          modelHint.textContent = 'Enter a key, or unlock the vault, first.'
          return
        }
        const controller = new AbortController()
        loadModelsButton.disabled = true
        try {
          const models = await listModels(collect(), key, controller.signal)
          modelList.replaceChildren()
          for (const model of models) {
            const option = document.createElement('option')
            option.value = model
            modelList.append(option)
          }
          modelHint.textContent =
            models.length > 0
              ? `${models.length} models available.`
              : 'The gateway did not return a model list. Type the model id.'
        } finally {
          loadModelsButton.disabled = false
        }
      })().catch((cause: unknown) => {
        modelHint.textContent = errorText(cause)
      })
    })

    detail.append(form)
    void refreshKeyPresence()

    /** Reports whether a key is already stored, without revealing it. */
    async function refreshKeyPresence(): Promise<void> {
      const presence = await keyPresence(profile.id)
      if (presence === 'none') return
      const note = document.createElement('p')
      note.className = 'field-hint'
      note.dataset.testid = 'provider-key-presence'
      note.textContent =
        presence === 'saved'
          ? 'A key is saved for this profile.'
          : 'A saved key could not be decrypted. Re-enter it.'
      if (!detail.querySelector('[data-testid="provider-key-presence"]')) {
        keyInput.closest('.field')?.after(note)
      }
    }
  }

  /** Status line that survives re-renders of the detail pane. */
  let statusElement: HTMLElement | undefined
  function ensureStatus(): HTMLElement {
    if (!statusElement) {
      statusElement = document.createElement('p')
      statusElement.className = 'provider-status'
      statusElement.dataset.testid = 'provider-status'
      statusElement.hidden = true
      statusElement.setAttribute('role', 'status')
    }
    return statusElement
  }

  function showStatus(
    element: HTMLElement,
    text: string,
    tone: 'ok' | 'error',
  ): void {
    element.hidden = false
    element.dataset.tone = tone
    element.textContent = text
  }

  function errorText(cause: unknown): string {
    if (cause instanceof GatewayError) {
      return cause.hint ? `${cause.message} ${cause.hint}` : cause.message
    }
    return cause instanceof Error ? cause.message : String(cause)
  }

  async function runConnectionTest(
    profile: ProviderProfile,
    status: HTMLElement,
  ): Promise<void> {
    const key = await resolveKey(profile.id, undefined)
    if (!key) {
      showStatus(
        status,
        'No key available. Enter one, or unlock the vault.',
        'error',
      )
      return
    }
    showStatus(status, 'Testing…', 'ok')
    const controller = new AbortController()
    let result: ConnectionCheck
    try {
      result = await testConnection(profile, key, controller.signal)
    } catch (cause) {
      showStatus(status, errorText(cause), 'error')
      return
    }
    if (result.ok) {
      const saved = {
        ...profile,
        verifiedAt: new Date().toISOString(),
      }
      await providerStore.save(saved)
      showStatus(
        status,
        result.models.length > 0
          ? `Connected. ${result.models.length} models available.`
          : 'Connected. The gateway does not list models.',
        'ok',
      )
    } else {
      showStatus(status, errorText(result.error), 'error')
    }
  }

  /** Returns the key to use: the field's value, else the vault's. */
  async function resolveKey(
    profileId: string,
    typed: string | undefined,
  ): Promise<string | undefined> {
    if (typed) return typed
    if (vaultState.status !== 'unlocked') return undefined
    return vault.get(keyRecordId(profileId)).catch(() => undefined)
  }

  async function keyPresence(profileId: string): Promise<KeyPresence> {
    if (vaultState.status === 'empty') return 'none'
    const stored = await vault.isReadable(keyRecordId(profileId))
    if (stored) return 'saved'
    if (vaultState.status === 'locked') {
      // Cannot tell without decrypting; report the conservative answer only
      // when a record exists at all.
      return 'none'
    }
    return 'unreadable'
  }

  return () => {
    unsubscribeVault()
    unsubscribeProfiles()
    root.classList.remove('providers')
    root.replaceChildren()
  }
}
