# 上游基线与定制说明

本仓库是 [RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner) 的定制 fork，
作为 SpellingPractice 项目的本地前端。许可证仍为 GPL-3.0，版权归上游作者及贡献者所有。

## 基线

| 项 | 值 |
|---|---|
| 上游仓库 | https://github.com/RealKai42/qwerty-learner |
| 基线 commit | `1182426f2bd0a28c95302c33f9e19136b1262a70`（master，2026-09-08） |
| 定制分支 | `spellingpractice` |
| 上游 remote | `upstream` |
| 应用版本 | 见根目录 `VERSION`，构建时注入页脚显示 |

## 相对上游的定制

1. **词库**：只注册 `雅思听力拼写练习`（9 套 450 词）。词典 JSON 不提交，由主仓库
   `scripts/build_webapp_dict.py` 从 `data/words.json` 生成到 `public/dicts/`。
2. **章节**：`CHAPTER_LENGTH` 50（一套一章），界面显示"第 N 套"。
3. **整词默写模式**：`firstLetter` 模式改为"整词提交"：
   - 题面只显示首字母提示，不显示任何下划线占位（不暴露词长），没有逐字母实时反馈；
   - 输入整词后按 Enter 统一判定，首字母可省略；Backspace 可删字符，第一个字母即开始练习；
   - 保留机械键盘敲击音效（逐字母校验路径被跳过，改为在输入/删除时直接播放）；
   - 第一次判定正确即完成该词本轮；答错时逐字符对齐展示差异（少了 / 多了 / 写错的字母分别
     高亮，`SpellDiff.tsx` + `utils/spellDiff.ts`），该词自动追加到本轮队尾补练一次
     （每词最多一次），并按 FSRS `Again` 立即排期（`markSrsFailure`）；
   - 输入可靠性：单词状态随组件按单词重挂载同步初始化，章节切换与答对推进改在 layout effect
     中完成，避免"看到新词的瞬间打字"或"答对后立刻打下词"丢失第一个按键；
   - 其他默写模式（全部隐藏/元音/辅音/随机）仍保留上游的逐字母校验逻辑。
4. **提示方式**：移除鼠标悬停显示答案；旧模式改为按住 Tab 临时提示（设置项同步改名）。
5. **词长隐藏**：下一个词的预览在整词模式下只显示首字母 + 省略号。
6. **发音兜底**：有道音频加载失败或断网时，自动改用浏览器内置语音（Web Speech API）。
7. **去统计**：移除 Mixpanel / Vercel Analytics 上报，保证离线可用（`src/utils/mixpanel.ts`、
   `src/utils/trackEvent.ts`、`src/index.tsx`）。
8. **智能复习**：集成 `ts-fsrs`，`srsRecords` 表（Dexie v4）保存记忆卡片；首页脑图按钮按
   到期时间生成复习队列，评分由拼写错误数与用时映射（`src/utils/db/srs.ts`）。
9. **一键启动**：`launcher/launcher.py` + `launcher/install_shortcut.ps1`，桌面快捷方式双击
   即用；固定端口 8756，SPA fallback，空闲 90 分钟自动退出。
10. **版本号**：根目录 `VERSION` + Vite `APP_VERSION` 注入页脚。
11. **pre-commit**：Windows 无全局 yarn，改用 `corepack yarn run lint-staged`。

## 同步上游

```bash
git fetch upstream
git merge upstream/master    # 冲突集中在上述定制点
git push origin spellingpractice
```

主仓库 SpellingPractice 以 submodule 方式锁定本仓库的提交，同步后需要在主仓库提升 submodule
指针并重新构建。

## 构建与运行

```powershell
# 主仓库根目录
pwsh -NoProfile -File scripts/webapp_build.ps1   # 校验词库 -> 生成词典 -> yarn build -> 裁剪
python webapp/launcher/launcher.py               # 启动本地服务 + Edge 应用窗口
pwsh -NoProfile -File webapp/launcher/install_shortcut.ps1   # 创建桌面快捷方式
```

## 许可

GPL-3.0，见 `LICENSE`。本 fork 的所有修改同样以 GPL-3.0 发布。
