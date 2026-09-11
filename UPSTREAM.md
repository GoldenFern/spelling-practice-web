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
3. **默写模式**：新增 `firstLetter`（只显示首字母），并设为默认开启；首字母已给出，打字时自动
   跳过（打错重打也会自动补回）；移除鼠标悬停显示答案，改为按住 Tab 临时提示（设置项同步改名，
   开关仍可关闭提示）。
4. **发音兜底**：有道音频加载失败或断网时，自动改用浏览器内置语音（Web Speech API）。
5. **去统计**：移除 Mixpanel / Vercel Analytics 上报，保证离线可用（`src/utils/mixpanel.ts`、
   `src/utils/trackEvent.ts`、`src/index.tsx`）。
6. **智能复习**：集成 `ts-fsrs`，`srsRecords` 表（Dexie v4）保存记忆卡片；首页脑图按钮按
   到期时间生成复习队列，评分由拼写错误数与用时映射（`src/utils/db/srs.ts`）。
7. **一键启动**：`launcher/launcher.py` + `launcher/install_shortcut.ps1`，桌面快捷方式双击
   即用；固定端口 8756，SPA fallback，空闲 90 分钟自动退出。
8. **版本号**：根目录 `VERSION` + Vite `APP_VERSION` 注入页脚。
9. **pre-commit**：Windows 无全局 yarn，改用 `corepack yarn run lint-staged`。

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
