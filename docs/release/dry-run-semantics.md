# Dry-run 的真实语义，以及为什么它要跑在 worktree 里

- 日期：2026-11-24
- 状态：zeus-ui `release.ts` 已隔离；上游缺陷未修（无法提交）

---

## 1. 结论先说

`pnpm release <version> --dry` **会改写工作树**。它改 46 个 `package.json`、
跑 `pnpm install --lockfile-only` 改 `pnpm-lock.yaml`，然后 precheck 里的
`build` 会写 `dist/`。

`--dry` 抑制的只有 npm publish 和 git commit/tag。

因此 zeus-ui 的 `release.ts` 在 `--dry` 时把整个流程移到一个 **detached 的
临时 worktree**，调用者的 checkout 不再被打开写入。

---

## 2. 证据

`@baicie/release@0.4.0` 的 `runRelease`（`dist/index.js`）：

```js
const version = await resolveReleaseVersion(activeConfig, options);
if (!options.dryRun && !options.skipGit) await assertCleanGit(activeConfig.cwd);
await confirmRelease(version, options);
await prepareVersion(activeConfig, version);        // ← 无条件执行
await run(activeConfig.packageManager ?? "pnpm", ["install", "--lockfile-only"], ...);
if (!options.skipPrecheck) await runPrecheck(activeConfig, { strict: true, ... });
```

而 `prepareVersion` 把 `dryRun` 写死：

```js
async function prepareVersion(config, version) {
  if (config.mode === "changesets-fixed") { ... return; }
  await versionPackages(config, { version, dryRun: false });   // ← 硬编码
}
```

`versionPackages` 自己是有 dry 分支的（`if (options.dryRun) { console.log('would version ...'); continue }`），
但 `prepareVersion` 永远传 `false`，所以那个分支在 `--dry` 路径上不可达。

库自己也在结尾打印：

```
Dry-run mutates version files, changelog and lockfile. Use git diff to inspect, then revert if needed.
```

也就是说上游**知道**这一点，并把它当作预期行为。

---

## 3. 为什么不向上游提 PR

这是最该修的地方，但做不到：

- `@baicie/release@0.4.0` 的 `package.json` 中 `repository` / `homepage` / `bugs`
  全部为 `null`；
- 本机没有它的源码 checkout。

没有可以提交的仓库，就不存在上游 PR。**这一条是事实记录，不是省略。**

zeus-ui 侧的隔离因此是**权宜**而非正解：它把缺陷关在本仓库之外，
一旦上游暴露真正的 dry-run，`release-rehearsal.ts` 可以整个删除，
调用方无需改动。

---

## 4. 隔离方案

`scripts/commands/release.ts`：

```
--dry 且非 --publishOnly
  → git worktree add --detach <tmp> HEAD
  → node_modules 软链到主 checkout（只读，rehearsal 的写入都在 worktree 内）
  → 子进程 cwd=<tmp>，带 ZEUS_RELEASE_REHEARSAL=1
  → 结束后移除 worktree
```

几个刻意的选择：

**detached HEAD。** rehearsal 不能创建或推进分支，也就无法把调用者留在别的
提交上，更无法 push。

**用 `HEAD` 而不是工作树。** 未提交的改动在 rehearsal 里自然不存在——
「这个发布能不能成立」本来就该针对已提交的树回答。

**`ZEUS_RELEASE_REHEARSAL=1` 短路。** 子进程执行的是同一个入口脚本，
没有这个标记它会再判定为 rehearsal 并再建一个 worktree，无限递归。

**不 `git checkout -- .`、不 `git reset --hard`、不 stash。**
用户的改动从不被触碰。这是与「跑完再还原」方案的本质区别：后者一旦中途失败
或被打断，用户的工作就没了。

**`process.once('exit')` 清理。** SIGINT/SIGTERM 之外，任何非 SIGKILL 的退出
路径都会移除 worktree。移除是幂等的。

---

## 5. 已验证

| 场景                             | 结果                                          |
| -------------------------------- | --------------------------------------------- |
| 工作树有未提交修改时执行 dry-run | 修改哈希不变，工作树未变                      |
| worktree 创建与移除              | 无遗留（`git worktree list` 只剩主 checkout） |
| 子进程递归                       | 未发生；进程链 2 层                           |
| `--publishOnly --dry`            | 不隔离（该路径不调 `prepareVersion`）         |
| 非 dry 的真实发布                | 不隔离（库自身 `assertCleanGit` 会拒绝脏树）  |

## 6. 完整 rehearsal 的结果

在 Node 22.12 本机跑完整 precheck，**EXIT=1**。失败与隔离无关：

| 失败项                                                                                              | 真因                                   | 是否环境导致                              |
| --------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- |
| `examples/ai-host/__tests__/protocol.spec.ts`<br>`examples/ai-host/__tests__/public-replay.spec.ts` | `No such built-in module: node:sqlite` | 是，Node 22.12 需 `--experimental-sqlite` |
| `scripts/checks/__tests__/ai-demo-provenance.spec.ts`（2 个用例）                                   | 同上，子进程起不来                     | 是                                        |
| `check-release-pairing.spec.ts`（1 个用例）                                                         | 5s 超时                                | 是，并发下的 flake；单独跑 38 个全过      |

`node:sqlite` 这一项在**主 checkout 上同样失败**，已直接验证——不是 worktree
引入的问题。结论：本机的 rehearsal 会一直红，直到 Node 版本满足前提；隔离
本身工作正常。

- `--dry` 被 SIGKILL 时 worktree 会遗留；`exit` 钩子无法覆盖 SIGKILL。
  下次运行会新建，不阻塞，但临时目录会累积。

## 6.1 一次误判，记录在此

首次尝试时我报告 worktree 里的 precheck 读不到
`packages/ai-adapters/src/shared.ts`，并怀疑是 `node_modules` 软链导致路径
被解析回主 checkout。**这个怀疑是错的**：实测 worktree 内 `process.cwd()`
与 `realpathSync('.')` 都指向 worktree，`pnpm exec` 也一样。真实原因是那次
运行与我手工执行的 `git worktree remove --force` 并发，目录被删掉了一半。

教训：不要在 rehearsal 运行时清理它的 worktree。

## 7. 对发出的那条 CI 命令的影响

`release.yml` 的 `dry-run` job 跑 `pnpm release "$VERSION" --tag "$TAG" --dry`。
在 CI 里工作树是一次性的，隔离与否无差别——但走隔离路径意味着 CI 与本地
执行的是**同一个**代码路径，不会出现「本地安全、CI 不安全」或反之。
