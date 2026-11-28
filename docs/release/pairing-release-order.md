# Core/UI 配对发布顺序

本文件回答一个问题：**在什么时刻可以记录配对，以及为什么。**

R25 的 rc.6–rc.9 连续四次卡在配对身份上，根因不是某个门禁过严，而是发布顺序
与配对协议之间存在一处未写明的假设。

---

## 1. 一处未写明的假设

配对记录写在 **Core 的 release tag 树里**，它命名一个 UI commit。协议假设：
**那个 UI commit 在 Core 发布之后不会再变。**

这个假设在两种情况下不成立：

| 情况                                          | 后果                                     |
| --------------------------------------------- | ---------------------------------------- |
| UI 的发布分支经 squash merge 合入 main        | 提交哈希改变，记录指向一个永不存在的提交 |
| UI 还需要 Core 发布后才能完成 frozen lockfile | 最终 UI 提交必须在 Core 之后才产生       |

两者都不是违规操作，是正常的工作流。协议只是没有为它们留位置。

---

## 2. 三种配对模式，按强度排序

| 模式                      | 何时使用                             | 证据位置                                             | 强度                   |
| ------------------------- | ------------------------------------ | ---------------------------------------------------- | ---------------------- |
| **Direct pairing**        | UI commit 在 Core 发布前就已冻结     | Core tag 树内的 `pairing/v<version>.json`            | 最强：发布前已验证     |
| **Bootstrap attestation** | Core 发布时 UI 还不存在              | Core tag 为 `uiCommit: null`，事后 `pair/v<version>` | 中：明确声明无配对     |
| **Pairing amendment**     | 已配对，但那个 UI candidate 从未发布 | `pair-amendment/v<version>`                          | 最弱：需要完整重新验收 |

**选择规则**：能用上面的，就不要用下面的。amendment 只在「direct pairing 已经
记录、但那个 UI 从未发布、且替换 candidate 已完整重新验收」时才适用。

---

## 3. 推荐发布顺序

### 3.1 能在 Core 发布前冻结 UI 的版本（首选）

```text
1. 确定 Core candidate（版本号、代码、全部修复）
2. 确定 UI candidate —— 一个具体的 commit，不再改动
3. 联合候选验收（Core 候选 tarball + UI 候选 tarball）
4. Core 发布
5. UI 发布，配对记录直接指向第 2 步的 commit
```

第 2 步的关键约束：**该 commit 必须已经是 UI main 上的提交**，而不是发布分支的
顶端。如果它还要经 PR 合并，就先用 squash 合并、拿到最终 SHA，再把它写进配对记录。

### 3.2 UI 必须等 Core 发布后才能完成的版本

```text
1. 确定 Core candidate
2. 确定 UI candidate（代码冻结，但 lockfile 尚未能解析 Core 的新版本）
3. 联合候选验收（用候选 tarball）
4. Core 发布
5. UI 重生成 lockfile —— 此时 Core 已在 registry
6. 合并全部 UI 修复到 main，取得最终 commit
7. 对最终 commit 重新执行完整 UI 验收
8. 生成 pairing amendment
9. UI 发布
```

第 8 步不可省略：第 3 步的验收针对的是**另一个 commit**，不能为最终 commit 背书。

---

## 4. 不要做的事

| 反模式                                    | 为什么                                       |
| ----------------------------------------- | -------------------------------------------- |
| 把发布分支的顶端写进配对记录              | squash merge 会改变哈希                      |
| 用旧 candidate 的验收报告为新 commit 背书 | 报告绑定的是旧树                             |
| 为修配对元数据而重发 Core                 | 已发布版本不可覆盖，且新版本号会掩盖真实原因 |
| 让 amendment 成为配对失败时的 fallback    | 它会被用来绕过 direct pairing                |
| 移动已发布的 tag                          | 规则集禁止，且它是发布证据的锚点             |

---

## 5. 检查清单（Core 发布前）

- [ ] 配对记录里的 `uiCommit` 是 UI **main 上已存在**的提交
- [ ] 该提交的根 `package.json` 版本等于 `coreVersion`
- [ ] 该提交的 `@zeus-js/*` pin 等于 `coreVersion`
- [ ] 联合候选验收针对**这个** commit 跑过，报告已留档
- [ ] 该 commit 不再需要任何修改

最后一条是全部问题的源头。如果 UI 还需要改，就不要记录配对。

---

## 6. 参考

- 协议实现：`scripts/release/release-protocol.ts`、`scripts/release/pairing-amendment.ts`
- 校验器：`scripts/checks/release/check-release-pairing.ts`
- R25 的完整事故记录：`docs/release/r25-rc6-release.md`
