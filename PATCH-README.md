# image-prompt-skill v0.8.4 视觉优化记录

当前仓库和 Codex 插件用法见 [README](README.md)。以下保留 v0.8.4 的视觉工作流改动记录。

当前技能入口：[SKILL.md](SKILL.md)。当前使用方法：[资产工作流](references/routes/asset-master-workflow.md)。

本版本根据用户优质全身标杆，补齐服装定妆展示、全身母图保留和审美对照路线。展示型允许适合设计的宽袖、层叠衣片与铺地裙摆；全身母图模式保留原脸、比例、姿态和服装，避免被默认预设重做。保留此前局部修复锁与 v0.8.2 命令兼容性；历史资源文件名不代表当前包版本。

```bash
node scripts/iteration-director.mjs asset-prompt --presentation costume_showcase --maturity-guard none --format text
node scripts/iteration-director.mjs asset-prompt --reference-mode full_body_anchor --format text
node scripts/iteration-director.mjs asset-prompt --stage material-light --focus materials --format text
```

需要 Node.js 22+，无第三方 npm 依赖。修改资源后运行：

```bash
npm run examples:build
npm test
npm run release:build
npm run validate
```

`RELEASE-MANIFEST.json` 是当前文件与 SHA-256 清单，排除自身和构建/缓存目录；旧版清单是历史快照。发布前需测试与校验都通过。`release:build` 只重建清单，不替代行为测试。

验证覆盖展示选择、手势覆盖优先级、母图保留、冲突拒绝、局部编辑隔离和发布完整性。实际出图与审美判断另存回执，不能将程序测试结果解释成图像生产稳定性。

- [优化计划](docs/v0.8.4-optimization-plan.md)
- [实现与效果报告](docs/v0.8.4-review-report.md)
- [自动生成的当前提示词](examples/ancient-white-asset-v084-prompts.md)
- [标杆对照工作流](references/routes/benchmark-costume-refinement.md)
- [标杆回归记录模板](templates/benchmark-comparison-record.json)
- [视觉回归记录模板](templates/visual-regression-record.json)
