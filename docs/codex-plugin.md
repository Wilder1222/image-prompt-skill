# Codex 插件

本仓库同时是可加载的插件根目录：`.codex-plugin/plugin.json` 声明 `./skills/`，`skills/image-prompt-skill/SKILL.md` 加载插件内的根 `SKILL.md`。脚本、参考、模板均位于同一插件根目录，安装后不读取开发机仓库路径。

## 构建

```bash
npm run release:build
npm run validate
npm run plugin:build
```

输出 `dist/codex-plugin/image-prompt-skill/`。构建前要求源文件清单和摘要有效，构建后再次验证完整目录。它会拒绝覆盖含未知文件或人工改动的旧构建目录。不要在构建目录内保存原始素材或工作成果。

插件清单、技能入口和提示词编译器都在 Git 中；克隆仓库后即可使用这些入口。构建目录和生成图片不加入 Git。

## 首次个人安装（Windows / PowerShell）

下面使用本机 Codex 自带的 `plugin-creator` 脚本注册默认个人 marketplace，不创建团队市场。需要 Python 3 与该技能。若配置了自定义 Codex 数据目录，将 `$creator` 改为实际技能目录。

```powershell
$creator = Join-Path $env:USERPROFILE '.codex/skills/.system/plugin-creator'
python "$creator/scripts/create_basic_plugin.py" image-prompt-skill --with-skills --with-marketplace
# 只有上一条命令成功后才继续。
$personalPlugin = Join-Path $env:USERPROFILE 'plugins/image-prompt-skill'
Get-ChildItem -Force 'dist/codex-plugin/image-prompt-skill' | Copy-Item -Destination $personalPlugin -Recurse -Force
python "$creator/scripts/validate_plugin.py" $personalPlugin
$marketplace = python "$creator/scripts/read_marketplace_name.py"
codex plugin add "image-prompt-skill@$marketplace"
```

若已存在同名个人插件，不重新运行首次 scaffold，也不覆盖其他插件的配置。默认个人 marketplace 为 `~/.agents/plugins/marketplace.json`，由 Codex 隐式发现，无需 `marketplace add`。

安装后新建一个 Codex 任务，让应用加载插件技能。可在插件详情中使用默认提示词，或在任务中输入 `$image-prompt-skill`。

## 更新已有个人插件

先重新构建，将经过验证的新构建内容更新到已注册的个人插件目录。然后使用官方 helper 刷新本地版本后缀：

```powershell
$creator = Join-Path $env:USERPROFILE '.codex/skills/.system/plugin-creator'
$personalPlugin = Join-Path $env:USERPROFILE 'plugins/image-prompt-skill'
$marketplace = python "$creator/scripts/read_marketplace_name.py"
python "$creator/scripts/update_plugin_cachebuster.py" $personalPlugin
npm --prefix $personalPlugin run release:build
python "$creator/scripts/validate_plugin.py" $personalPlugin
codex plugin add "image-prompt-skill@$marketplace"
```

`plugin:sync` 会保留与包版本匹配的 `+codex.<token>` 后缀，实际功能版本由 `package.json` 管理。刷新后重建摘要，避免已安装目录的版本变动导致清单过期。再开一个新任务使用更新。

## 验证边界

`npm run plugin:check` 检查清单与入口同步；Codex 的 `validate_plugin.py` 校验插件 schema；`codex plugin add` 验证真实安装。最终仍需在新任务中加载技能。插件没有额外 MCP 服务、登录凭证或外部生成器；实际出图工具由宿主提供。
