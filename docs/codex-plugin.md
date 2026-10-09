# Codex 插件构建与更新

本仓库是插件根目录，`.codex-plugin/plugin.json` 声明 `./skills/`，技能入口读取包内根 `SKILL.md`。脚本、规则与编译器自包含；安装后的任务读取实际缓存副本，不能将源码更新当成安装完成。

## 构建

```powershell
npm run examples:build
npm run release:build
npm run validate
npm run plugin:build
```

构建输出为 `dist/codex-plugin/image-prompt-skill/`。构建器检查源清单、文件摘要与包内链接，拒绝覆盖含未知文件或人工改动的旧构建目录。原始图片和本地成果不放入构建目录。

## 已注册个人插件的更新

先运行 `codex plugin list --marketplace personal --json`，找到本插件的实际 `source.path`；不要凭示例路径覆盖其他目录。确认原目录属于本插件，备份全部原内容，再用完整新构建替换该源目录。递归移动或清理之前分别核对来源、目标和备份目录的绝对路径，拒绝符号链接与范围外路径。

每次更新使用新功能版本或新的兼容缓存后缀。辅助 `plugin-creator` 脚本在部分安装中不存在，不把它作为必需依赖。已有插件可以在已核对的源目录中更新兼容清单版本，并重新生成发布摘要：

```powershell
# taskPluginSource 必须来自上一步已核对的 source.path。
$taskPluginSource = Join-Path $env:USERPROFILE 'plugins/image-prompt-skill'
$taskManifestPath = Join-Path $taskPluginSource '.codex-plugin/plugin.json'
$taskManifest = Get-Content -LiteralPath $taskManifestPath -Raw | ConvertFrom-Json
$taskPackage = Get-Content -LiteralPath (Join-Path $taskPluginSource 'package.json') -Raw | ConvertFrom-Json
if ($taskManifest.name -ne 'image-prompt-skill') { throw 'Unexpected plugin source' }
$taskManifest.version = $taskPackage.version + '+codex.' + [DateTime]::UtcNow.ToString('yyyyMMddHHmmssffff')
[IO.File]::WriteAllText($taskManifestPath, ($taskManifest | ConvertTo-Json -Depth 20) + "`n", [Text.UTF8Encoding]::new($false))
npm --prefix $taskPluginSource run release:build
# 只有发布校验成功后才继续安装。
codex plugin add image-prompt-skill@personal --json
codex plugin list --marketplace personal --json
```

`plugin:sync` 保留与功能版本匹配的 `+codex.<token>` 后缀。按安装返回的 `installedPath` 核验实际文件，而非自行假定缓存位置；在仓库外调用缓存内编译器，检查默认比例、错误字段拒绝及当前入口内容。源码、安装源和缓存三处的规则与脚本摘要应一致，兼容版本后缀及由其生成的清单允许不同。

## 首次注册与加载

已有同名个人插件不重复 scaffold。首次注册按 [官方插件打包与市场说明](https://developers.openai.com/plugins/build/plugins) 配置个人或项目 marketplace，并使用实际安装入口。可用辅助技能时按其当次文档处理，不复制失效脚本路径。

安装结果证明缓存已更新，不证明已打开的聊天重新加载了技能。后续新任务读取新插件；需要核验加载时查看该任务实际技能路径。更新不自动重启应用或新建用户聊天。

## 验证边界

包构建与安装核验不能证明生成效果。插件没有额外供应商服务、密钥或后台生成器，实际出图依赖宿主提供的工具。现行生产契约、局部保护、运行时长度校验与实图失败继续按各自证据记录。
