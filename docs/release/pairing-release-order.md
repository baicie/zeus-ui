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
7. 对最终 commit 重新执行完整 UI 验收，产出五份报告
8. 写证据包并提交（`meta/release/evidence/v<version>/bundle.json`）
9. 合并证据包 PR
10. 生成 pairing amendment（`--change-reference` 指向第 9 步的 PR）
11. 创建 `pair-amendment/v<version>` tag
12. UI 发布
```

第 7 步不可省略：第 3 步的验收针对的是**另一个 commit**，不能为最终 commit 背书。

第 8–10 步的顺序仍然不可交换，但原因变了：amendment 的 `--amendment-commit`
必须是证据包已经提交的那个 commit，而 tag 必须指向同一个 commit。三者指向不同
的树，读者就无法从 tag 一路走到报告。

### 3.3 第 8–11 步的具体命令

```bash
# 8. 证据包 —— 五份报告来自第 7 步。producer 可以是 workflow 或 local；
#    local 必须带 --command，因为读者只能靠它复现。
pnpm exec tsx scripts/release/write-evidence-bundle.ts \
  --version 0.2.0-rc.8 \
  --core-commit <Core tag 指向的 commit> \
  --ui-commit <最终 UI commit> \
  --ui-tree <该 commit 的根 tree> \
  --lockfile <该 commit 的 pnpm-lock.yaml> \
  --core-registry-report <path> --ui-candidate-report <path> \
  --template-acceptance <path> --browser-acceptance <path> \
  --ui-registry-preflight <path> \
  --out meta/release/evidence/v0.2.0-rc.8/bundle.json

# 10. amendment —— 在已合并的证据包 commit 上运行
pnpm exec tsx scripts/release/write-pairing-amendment.ts \
  --version 0.2.0-rc.8 \
  --ui-commit <最终 UI commit> \
  --amendment-commit <即将打 tag 的 Core commit> \
  --change-reference "baicie/zeus#<PR 号>"

# 11. tag
git tag pair-amendment/v0.2.0-rc.8 <amendment commit>
git push origin pair-amendment/v0.2.0-rc.8
```

`--amendment-commit` 是必填的，不是可选的便利参数：证据包必须已经提交在这个
commit 的树里，而 tag 必须指向同一个 commit。少了它，amendment 钉住的 bundle
就不在 tag 能读到的位置，读者无法从 tag 一路走到五份报告。

---

## 4. 不要做的事

| 反模式                                    | 为什么                                        |
| ----------------------------------------- | --------------------------------------------- |
| 把发布分支的顶端写进配对记录              | squash merge 会改变哈希                       |
| 用旧 candidate 的验收报告为新 commit 背书 | 报告绑定的是旧树                              |
| 为修配对元数据而重发 Core                 | 已发布版本不可覆盖，且新版本号会掩盖真实原因  |
| 让 amendment 成为配对失败时的 fallback    | 它会被用来绕过 direct pairing                 |
| 移动已发布的 tag                          | 规则集禁止，且它是发布证据的锚点              |
| 先写 amendment 再补 approve               | 批准针对的是另一个 commit，校验器会拒绝       |
| 在 `pairingMode` 之外推断配对方式         | 报告里的 `pairTag` 曾对每种模式都写成 `pair/` |

---

## 5. 检查清单（Core 发布前）

- [ ] 配对记录里的 `uiCommit` 是 UI **main 上已存在**的提交
- [ ] 该提交的根 `package.json` 版本等于 `coreVersion`
- [ ] 该提交的 `@zeus-js/*` pin 等于 `coreVersion`
- [ ] 联合候选验收针对**这个** commit 跑过，报告已留档
- [ ] 该 commit 不再需要任何修改

最后一条是全部问题的源头。如果 UI 还需要改，就不要记录配对。

---

## 6. amendment 的可信性由什么保证

amendment 是三种模式中最弱的一种，所以它的每个字段都被文件之外的东西校验：

| 字段                         | 对照物                                      |
| ---------------------------- | ------------------------------------------- |
| `coreCommit`                 | 受保护的 `v<version>` tag 解析出的提交      |
| `originalPairing.*`          | tag 树内配对记录的字节（含 `recordSha256`） |
| `replacement.uiCommit`       | UI 仓库的真实提交                           |
| `replacement.uiTree`         | 该提交的根 tree                             |
| `replacement.lockfileSha256` | 从该提交的 tree 取出的 blob，按其字节计算   |
| `evidence.bundleSha256`      | 与 amendment 一同提交在 tag 树内的证据包    |

### 授权从哪来

`authorization` 记录 `releasedBy` / `releasedAt` / `changeReference`，它们**不是**
授权本身，只是「谁在什么时候发的、去哪儿看」。

真正的授权是 **tag 本身**，可信度来自它被锚定的东西——这些都不是 tag 能伪造的：

1. tag 受规则集 27438539 覆盖，删不掉也移不动（对真实远端验证，不看规则名）；
2. amendment 的每个字段都对照受保护的 `v<version>` tag、tag 内的记录字节，
   以及 UI 仓库的真实内容；
3. 它钉住的证据包提交在同一棵树里，每份报告按自身数字重算结论。

改写 amendment 会让校验失败，除非把已发布的 Core 也一起改写——而 tag 保护不允许。

> **为什么不是审批。** 早先的版本要求一个 GitHub approve review。单人仓库里这
> 条无法满足：唯一的 admin 就是开 PR 的账号，GitHub 直接拒绝
> `Review Can not approve your own pull request`。**无法满足的门禁等于让人绕过
> 整个协议**，所以移除。若将来有第二位维护者，恢复 review 要求是
> `PairingAuthorization` 一处改动，注释里记了原因。

证据包内部同样互相约束：每份报告带自己的字节、产生者、对应的 commit 和
由自身数字重算出的结论。「6 个模板全过」「0 个已发布」这类条件是报告自己的
计数，不是可以调低的阈值。

---

## 7. 参考

- 协议实现：`scripts/release/release-protocol.ts`、`scripts/release/pairing-amendment.ts`、
  `scripts/release/evidence-bundle.ts`
- 写入工具：`scripts/release/write-evidence-bundle.ts`、`scripts/release/write-pairing-amendment.ts`
- 校验器：`scripts/checks/release/check-release-pairing.ts`
- R25 的完整事故记录：`docs/release/r25-rc6-release.md`
