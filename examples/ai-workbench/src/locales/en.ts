/**
 * Workbench chrome copy (English) — the source of truth for every key.
 *
 * Flat, dot-separated keys; `{name}` marks a value the caller interpolates.
 * This catalog is UI chrome only. It deliberately contains no conversation
 * content, model names, provider ids, gateway URLs, error codes or Host
 * payload text: those are data and are rendered verbatim.
 *
 * Product names and protocol terms stay in English in every locale:
 * "Zeus", "Agent", "BYOK", "SSE", "Host".
 */
export const en = {
  'workbench.documentTitle': 'Zeus Native AI Workbench',

  /* ------------------------------------------------------------- sidebar */
  'workbench.sidebarLabel': 'Chats',
  'workbench.brandMenu': 'Chat menu',
  'workbench.closeSidebar': 'Close sidebar',
  'workbench.openSidebar': 'Open sidebar',
  'workbench.newChat': 'New chat',
  'workbench.searchChats': 'Search chats',
  'workbench.recent': 'Recent',
  'workbench.noChats': 'No chats yet.',
  'workbench.settings': 'Settings',
  'workbench.workspaceName': 'Zeus workspace',
  'workbench.localChat': 'Local chat',
  'workbench.referenceConversation': 'Reference conversation',
  'workbench.sessionTitle': 'Session {index}',

  /* -------------------------------------------------------------- topbar */
  'workbench.hostConnection': 'Host connection: {status}',
  'workbench.hostConnectionTitle': 'Host connection',
  'workbench.connection.idle': 'idle',
  'workbench.connection.connecting': 'connecting',
  'workbench.connection.live': 'live',
  'workbench.connection.recovering': 'recovering',
  'workbench.connection.offline': 'offline',
  'workbench.connection.replay': 'replaying a recording',
  'workbench.connection.replayAria': 'Host connection: replaying a recording',
  'workbench.toggleTheme': 'Toggle colour scheme',
  'workbench.activityPanelShort': 'panel',
  'workbench.agentActivity': 'Agent activity',
  'workbench.closeActivityPanel': 'Close activity panel',
  'workbench.replayNotice':
    'Public replay · read-only. Sending messages, proposing and approving are disabled.',

  /* ------------------------------------------------------------- welcome */
  'workbench.welcomeTitle': 'Where should we begin?',
  'workbench.welcomeSuggestion': 'What can you do?',
  'workbench.welcomeSuggestionPrompt': 'What can you do in this workspace?',

  /* ----------------------------------------------------- thread/composer */
  'workbench.timelineLabel': 'Workbench conversation',
  'workbench.composerLabel': 'Ask the agent',
  'workbench.composerPlaceholder': 'Ask anything',
  'workbench.attachFile': 'Attach file',
  'workbench.uploading': 'Uploading…',
  'workbench.attached': '{name} attached',
  'workbench.attachmentUploadFailed': 'Attachment upload failed',
  'workbench.uploadFailed': 'Upload failed ({status})',
  'workbench.checksFailed': 'Checks failed ({status})',

  /* --------------------------------------------------------- inspector */
  'workbench.requestProtectedWrite': 'Request protected write',
  'workbench.noPendingApprovals': 'No pending approvals',
  'workbench.changedFiles': 'Changed files',
  'workbench.runChecks': 'Run checks',
  'workbench.tabApprovals': 'Approvals',
  'workbench.tabChanges': 'Changes',
  'workbench.tabTests': 'Tests',

  /* ----------------------------------------------------- conversations */
  'workbench.chatOptionsFor': 'Chat options for {title}',
  'workbench.chatTitle': 'Chat title',
  'workbench.rename': 'Rename',
  'workbench.delete': 'Delete',
  'workbench.deleteChatTitle': 'Delete chat?',
  'workbench.deleteChatCopy':
    '“{title}” will be removed from this list. This cannot be undone.',
  'workbench.cancel': 'Cancel',

  /* ------------------------------------------------------ modes/settings */
  'workbench.runMode': 'Run mode',
  'workbench.modeAgent': 'Agent',
  'workbench.modeByok': 'My model',
  'workbench.backToChat': 'Back to chat',
  'workbench.language': 'Language',
  'workbench.languageDescription':
    'Interface language. Messages, code, diffs and tool output are never translated.',
  'workbench.languageEnglish': 'English',
  'workbench.languageChinese': '简体中文',

  /* ------------------------------------------------ runtime (WC elements) */
  'workbench.generatingResponse': 'Generating response',
  'workbench.artifactPreview': 'Artifact preview',
  'workbench.stepsLabel': 'Steps',

  /* --------------------------------------------------------------- BYOK */
  // Product and protocol terms deliberately stay in English in every locale:
  // "BYOK", "OpenAI", "Host", "SSE", "Agent", plus model ids and gateway URLs
  // (which are data). "tokens" is industry vocabulary and is kept verbatim.
  'byok.emptyTitle': 'Configure a model to start',
  'byok.emptyCopy':
    'Add an OpenAI-compatible gateway in Settings. Requests go straight from this browser to your provider; the key is encrypted in this browser behind your passphrase.',
  'byok.openSettings': 'Open provider settings',
  'byok.retry': 'Retry',
  'byok.dismiss': 'Dismiss',
  'byok.messageLabel': 'Message',
  'byok.addFiles': 'Add files and more',
  'byok.attachmentsUnsupported':
    'Attachments are not supported by the browser gateway yet',
  'byok.send': 'Send',
  'byok.stop': 'Stop generating',
  'byok.hint': 'Enter to send · Shift+Enter for a new line',
  'byok.copyResponse': 'Copy response',
  'byok.tokens': '{count} tokens',
  'byok.noProviderConfigured': 'No provider configured',
  'byok.providerFallback': 'Provider',
  'byok.noModel': 'no model',
  'byok.stopped': 'Stopped.',
  'byok.stoppedBeforeFinished': 'Stopped before the answer finished.',
  'byok.truncated': 'The answer was cut off at the token limit.',
  'byok.addProviderFirst': 'Add and activate a provider in Settings first.',
  'byok.noSavedKey': 'This provider has no saved key. Add one in Settings.',
  'byok.unlockToUseKey': 'Unlock the vault to use the saved key.',

  /* --------------------------------------------------- settings: providers */
  'byok.providersTitle': 'Model providers',
  'byok.providersDescription':
    'Bring your own gateway. Keys are encrypted in this browser and never sent to the Zeus Host.',
  'byok.securityNotice':
    'Encryption protects keys stored on this device. It cannot protect a key from malicious script running on this page while the vault is unlocked.',
  'byok.vaultUnlocked': 'Vault unlocked',
  'byok.vaultLocked': 'Vault locked',
  'byok.vaultEmpty': 'No vault yet',
  'byok.createVault': 'Create vault',
  'byok.unlock': 'Unlock',
  'byok.lock': 'Lock',
  'byok.changePassphrase': 'Change passphrase',
  'byok.deleteVault': 'Delete vault',
  'byok.choosePassphraseTitle': 'Choose a vault passphrase',
  'byok.passphrase': 'Passphrase',
  'byok.confirmPassphrase': 'Confirm passphrase',
  'byok.passphraseMismatch': 'The two passphrases do not match.',
  'byok.unlockVaultTitle': 'Unlock the vault',
  'byok.changePassphraseTitle': 'Change the vault passphrase',
  'byok.currentPassphrase': 'Current passphrase',
  'byok.newPassphrase': 'New passphrase',
  'byok.deleteVaultConfirm':
    'Delete the vault and every stored key? Conversations stay; keys cannot be recovered.',
  'byok.profiles': 'Profiles',
  'byok.add': 'Add',
  'byok.noProviders': 'No providers yet. Add one to start a BYOK chat.',
  'byok.newProvider': 'New provider',
  'byok.untitled': 'Untitled',
  'byok.verified': 'verified',
  'byok.selectProvider': 'Select or add a provider.',
  'byok.fieldProfileName': 'Profile name',
  'byok.fieldBaseUrl': 'Base URL',
  'byok.fieldApiKey': 'API key',
  'byok.pasteKey': 'Paste the key',
  'byok.fieldModel': 'Model',
  'byok.fieldChatPath': 'Chat path',
  'byok.fieldTimeout': 'Timeout (ms)',
  'byok.fieldTemperature': 'Temperature',
  'byok.fieldMaxTokens': 'Max output tokens',
  'byok.baseUrlHint':
    'The gateway root. /chat/completions and /models are appended.',
  'byok.apiKeyHintUnlocked':
    'Stored encrypted. Leave blank to keep the saved key.',
  'byok.apiKeyHintLocked': 'Unlock the vault to change the saved key.',
  'byok.modelHint':
    'Load from the gateway, or type the model id if /models is unavailable.',
  'byok.loadModels': 'Load models',
  'byok.defaultPath': 'Default {path}',
  'byok.streamResponses': 'Stream responses',
  'byok.save': 'Save',
  'byok.testConnection': 'Test connection',
  'byok.active': 'Active',
  'byok.useForChat': 'Use for chat',
  'byok.delete': 'Delete',
  'byok.deleteProviderConfirm': 'Delete this provider and its stored key?',
  'byok.unlockBeforeSaving': 'Unlock the vault before saving a key.',
  'byok.saved': 'Saved.',
  'byok.enterKeyOrUnlock': 'Enter a key, or unlock the vault, first.',
  'byok.modelsAvailable': '{count} models available.',
  'byok.noModelList':
    'The gateway did not return a model list. Type the model id.',
  'byok.keySaved': 'A key is saved for this profile.',
  'byok.keyUnreadable': 'A saved key could not be decrypted. Re-enter it.',
  'byok.noKeyAvailable': 'No key available. Enter one, or unlock the vault.',
  'byok.testing': 'Testing…',
  'byok.connectedWithModels': 'Connected. {count} models available.',
  'byok.connectedWithoutModels': 'Connected. The gateway does not list models.',
} as const

export type WorkbenchMessageKey = keyof typeof en
