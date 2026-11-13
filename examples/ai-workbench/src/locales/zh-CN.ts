/**
 * Workbench chrome copy (Simplified Chinese).
 *
 * Typed against the English source of truth: `en` supplies the key set, and
 * the explicit annotation makes a missing or stray key a type error under
 * `isolatedDeclarations`. Values are the copy, never data.
 *
 * Kept in English on purpose (product names / protocol terms):
 * - Zeus, Agent, BYOK, SSE, Host, OpenAI — brand and protocol identifiers.
 * - Model ids, provider ids, gateway URLs, API keys and error codes never reach
 *   this file; they are rendered exactly as the Host or gateway sent them.
 * - Placeholders such as `{name}`, `{status}`, `{index}`, `{title}`.
 */
import type { en, WorkbenchMessageKey } from './en'

export const zhCN: Record<WorkbenchMessageKey, string> = {
  'workbench.documentTitle': 'Zeus Native AI 工作台',

  /* ------------------------------------------------------------- sidebar */
  'workbench.sidebarLabel': '会话',
  'workbench.brandMenu': '会话菜单',
  'workbench.closeSidebar': '关闭侧边栏',
  'workbench.openSidebar': '打开侧边栏',
  'workbench.newChat': '新建会话',
  'workbench.searchChats': '搜索会话',
  'workbench.recent': '最近',
  'workbench.noChats': '还没有会话。',
  'workbench.settings': '设置',
  'workbench.workspaceName': 'Zeus 工作区',
  'workbench.localChat': '本地会话',
  'workbench.referenceConversation': '参考会话',
  'workbench.sessionTitle': '会话 {index}',

  /* -------------------------------------------------------------- topbar */
  'workbench.hostConnection': 'Host 连接：{status}',
  'workbench.hostConnectionTitle': 'Host 连接',
  'workbench.connection.idle': '空闲',
  'workbench.connection.connecting': '连接中',
  'workbench.connection.live': '已连接',
  'workbench.connection.recovering': '恢复中',
  'workbench.connection.offline': '已离线',
  'workbench.connection.replay': '正在回放录制',
  'workbench.connection.replayAria': 'Host 连接：正在回放录制',
  'workbench.toggleTheme': '切换配色',
  'workbench.activityPanelShort': '面板',
  'workbench.agentActivity': 'Agent 活动',
  'workbench.closeActivityPanel': '关闭活动面板',
  'workbench.replayNotice':
    '回放预览 · 只读。这里回放一段真实 Agent 会话录制，不能发送消息、提案或审批。把顶栏模型选择器切到“我的模型”，即可用你自己的网关聊天。',

  /* ------------------------------------------------------------- welcome */
  'workbench.welcomeTitle': '想从哪里开始？',
  'workbench.welcomeSuggestion': '你能做什么？',
  'workbench.welcomeSuggestionPrompt': '你能在这个工作区里做什么？',

  /* ----------------------------------------------------- thread/composer */
  'workbench.timelineLabel': '工作台会话',
  'workbench.composerLabel': '向 Agent 提问',
  'workbench.composerPlaceholder': '问点什么',
  'workbench.attachFile': '附加文件',
  'workbench.uploading': '上传中…',
  'workbench.attached': '{name} 已附加',
  'workbench.attachmentUploadFailed': '附件上传失败',
  'workbench.uploadFailed': '上传失败（{status}）',
  'workbench.checksFailed': '检查失败（{status}）',

  /* --------------------------------------------------------- inspector */
  'workbench.requestProtectedWrite': '请求受保护的写入',
  'workbench.noPendingApprovals': '没有待批准的请求',
  'workbench.changedFiles': '更改的文件',
  'workbench.runChecks': '运行检查',
  'workbench.tabApprovals': '审批',
  'workbench.tabChanges': '更改',
  'workbench.tabTests': '测试',

  /* ----------------------------------------------------- conversations */
  'workbench.chatOptionsFor': '{title} 的会话选项',
  'workbench.chatTitle': '会话标题',
  'workbench.rename': '重命名',
  'workbench.delete': '删除',
  'workbench.deleteChatTitle': '删除会话？',
  'workbench.deleteChatCopy': '“{title}”将从列表中移除，此操作无法撤销。',
  'workbench.cancel': '取消',

  /* ------------------------------------------------------ modes/settings */
  'workbench.runMode': '运行模式',
  'workbench.modeAgent': 'Agent',
  'workbench.modeByok': '我的模型',
  'workbench.pickerOpen': '选择模型',
  'workbench.pickerAgentSection': 'Agent',
  'workbench.pickerAgentHint': '只读回放一段真实 Host 会话录制',
  'workbench.pickerModelSection': '你的模型',
  'workbench.pickerNoModel': '尚未配置',
  'workbench.pickerReplay': '回放',
  'workbench.pickerSetupModel': '配置你的模型',
  'workbench.pickerSetupModelHint': 'Base URL、API Key 和模型 id',
  'workbench.backToChat': '返回会话',
  'workbench.language': '语言',
  'workbench.languageDescription':
    '界面语言。消息、代码、diff 与工具输出不会被翻译。',
  'workbench.languageEnglish': 'English',
  'workbench.languageChinese': '简体中文',

  /* ------------------------------------------------ runtime (WC elements) */
  'workbench.generatingResponse': '正在生成回复',
  'workbench.artifactPreview': '产物预览',
  'workbench.stepsLabel': '步骤',

  /* --------------------------------------------------------------- BYOK */
  'byok.emptyTitle': '先配置一个模型',
  'byok.emptyCopy':
    '在设置里添加一个 OpenAI 兼容网关。请求会从这个浏览器直接发往你的服务商；密钥在你的口令保护下加密保存在本浏览器。',
  'byok.openSettings': '打开服务商设置',
  'byok.retry': '重试',
  'byok.dismiss': '关闭',
  'byok.messageLabel': '消息',
  'byok.addFiles': '添加文件及其他内容',
  'byok.attachmentsUnsupported': '浏览器网关暂不支持附件',
  'byok.send': '发送',
  'byok.stop': '停止生成',
  'byok.hint': 'Enter 发送 · Shift+Enter 换行',
  'byok.copyResponse': '复制回复',
  'byok.tokens': '{count} tokens',
  'byok.noProviderConfigured': '未配置服务商',
  'byok.providerFallback': '服务商',
  'byok.noModel': '无模型',
  'byok.thinking': '正在思考…',
  'byok.stopped': '已停止。',
  'byok.stoppedBeforeFinished': '回答未完成即被停止。',
  'byok.truncated': '回答在 token 上限处被截断。',
  'byok.addProviderFirst': '请先在设置中添加并启用一个服务商。',
  'byok.noSavedKey': '该服务商没有已保存的密钥，请在设置中添加。',
  'byok.unlockToUseKey': '解锁保险库后才能使用已保存的密钥。',

  /* --------------------------------------------------- settings: providers */
  'byok.providersTitle': '模型服务商',
  'byok.providersDescription':
    '自带网关。密钥在本浏览器内加密，永远不会发送到 Zeus Host。',
  'byok.securityNotice':
    '加密保护的是保存在本设备上的密钥。当保险库处于解锁状态时，它无法阻止本页面上运行的恶意脚本读取密钥。',
  'byok.vaultUnlocked': '保险库已解锁',
  'byok.vaultLocked': '保险库已锁定',
  'byok.vaultEmpty': '尚未创建保险库',
  'byok.createVault': '创建保险库',
  'byok.unlock': '解锁',
  'byok.lock': '锁定',
  'byok.changePassphrase': '修改口令',
  'byok.deleteVault': '删除保险库',
  'byok.choosePassphraseTitle': '设置保险库口令',
  'byok.passphrase': '口令',
  'byok.confirmPassphrase': '确认口令',
  'byok.passphraseMismatch': '两次输入的口令不一致。',
  'byok.unlockVaultTitle': '解锁保险库',
  'byok.changePassphraseTitle': '修改保险库口令',
  'byok.currentPassphrase': '当前口令',
  'byok.newPassphrase': '新口令',
  'byok.deleteVaultConfirm':
    '删除保险库及其中保存的所有密钥？会话会保留，但密钥无法找回。',
  'byok.profiles': '配置',
  'byok.add': '添加',
  'byok.noProviders': '还没有服务商。添加一个即可开始 BYOK 会话。',
  'byok.newProvider': '新服务商',
  'byok.untitled': '未命名',
  'byok.verified': '已验证',
  'byok.selectProvider': '选择或添加一个服务商。',
  'byok.fieldProfileName': '配置名称',
  'byok.fieldBaseUrl': 'Base URL',
  'byok.fieldApiKey': 'API key',
  'byok.pasteKey': '粘贴密钥',
  'byok.fieldModel': '模型',
  'byok.fieldChatPath': 'Chat 路径',
  'byok.fieldTimeout': '超时（毫秒）',
  'byok.fieldTemperature': 'Temperature',
  'byok.fieldMaxTokens': '最大输出 tokens',
  'byok.baseUrlHint': '网关根地址。请求时会拼接 /chat/completions 与 /models。',
  'byok.apiKeyHintUnlocked': '加密保存。留空则继续使用已保存的密钥。',
  'byok.apiKeyHintLocked': '解锁保险库后才能修改已保存的密钥。',
  'byok.modelHint': '可从网关加载模型；若 /models 不可用，直接填写模型 id。',
  'byok.loadModels': '加载模型',
  'byok.defaultPath': '默认 {path}',
  'byok.streamResponses': '流式返回',
  'byok.save': '保存',
  'byok.testConnection': '测试连接',
  'byok.active': '使用中',
  'byok.useForChat': '用于会话',
  'byok.delete': '删除',
  'byok.deleteProviderConfirm': '删除该服务商及其保存的密钥？',
  'byok.unlockBeforeSaving': '请先解锁保险库再保存密钥。',
  'byok.saved': '已保存。',
  'byok.enterKeyOrUnlock': '请先输入密钥，或解锁保险库。',
  'byok.modelsAvailable': '有 {count} 个可用模型。',
  'byok.noModelList': '网关未返回模型列表，请直接填写模型 id。',
  'byok.keySaved': '该配置已保存密钥。',
  'byok.keyUnreadable': '已保存的密钥无法解密，请重新输入。',
  'byok.noKeyAvailable': '没有可用密钥。请输入一个，或解锁保险库。',
  'byok.testing': '测试中…',
  'byok.connectedWithModels': '已连接。有 {count} 个可用模型。',
  'byok.connectedWithoutModels': '已连接。该网关未提供模型列表。',
} satisfies Record<keyof typeof en, string>
