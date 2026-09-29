import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillDirectory = 'skills/image-prompt-skill';
const readJson = (base, name) => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));

function matchingVersion(pluginVersion, packageVersion) {
  if (pluginVersion === packageVersion) return true;
  const prefix = `${packageVersion}+codex.`;
  return typeof pluginVersion === 'string' && pluginVersion.startsWith(prefix)
    && /^[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$/.test(pluginVersion.slice(prefix.length));
}

export function pluginEntry(base) {
  const source = fs.readFileSync(path.join(base, 'SKILL.md'), 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) throw new Error('root SKILL.md must have YAML frontmatter');
  return `---\n${frontmatter[1].replaceAll('\r\n', '\n')}\n---\n\n# Image Prompt Skill for Codex\n\n`
    + '先读取 [主工作流](../../SKILL.md)，再按该工作流选择所需参考。此入口由 `npm run plugin:sync` 生成；行为规则只在主工作流中维护。\n\n'
    + '本文件所在目录的 `../..` 是插件根目录。主工作流中的 `references/`、`resources/`、`templates/`、`examples/` 和 `scripts/` 路径均相对插件根目录解析；从插件根目录执行命令，或使用解析后的绝对路径。\n\n'
    + '插件已包含全部规则与编译器，安装后不依赖原始仓库路径。需要实际生成或编辑图像时，按用户请求调用宿主已有图像工具，并保留真实输出与验证边界。\n';
}

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export function syncPlugin(base) {
  const pkg = readJson(base, 'package.json');
  const manifest = readJson(base, '.codex-plugin/plugin.json');
  if (pkg.name !== 'image-prompt-skill' || manifest.name !== pkg.name) throw new Error('plugin and package names must both be image-prompt-skill');
  if (!matchingVersion(manifest.version, pkg.version)) manifest.version = pkg.version;
  writeIfChanged(path.join(base, '.codex-plugin/plugin.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeIfChanged(path.join(base, skillDirectory, 'SKILL.md'), pluginEntry(base));
  writeIfChanged(path.join(base, skillDirectory, 'agents/openai.yaml'), fs.readFileSync(path.join(base, 'agents/openai.yaml'), 'utf8'));
  return validatePluginSupport(base);
}

export function validatePluginSupport(base) {
  const errors = [];
  try {
    const pkg = readJson(base, 'package.json'), manifest = readJson(base, '.codex-plugin/plugin.json');
    if (manifest.name !== 'image-prompt-skill' || manifest.name !== pkg.name) errors.push('plugin/package name mismatch');
    if (!matchingVersion(manifest.version, pkg.version)) errors.push('plugin/package version mismatch; run npm run plugin:sync');
    if (manifest.skills !== './skills/') errors.push('plugin skills must point to ./skills/');
    if (!manifest.author?.name?.trim()) errors.push('plugin author name is required');
    for (const key of ['displayName', 'shortDescription', 'longDescription', 'developerName', 'category']) {
      if (typeof manifest.interface?.[key] !== 'string' || !manifest.interface[key].trim()) errors.push(`missing plugin interface.${key}`);
    }
    const prompts = manifest.interface?.defaultPrompt;
    if (!Array.isArray(prompts) || prompts.length < 1 || prompts.length > 3 || prompts.some(p => typeof p !== 'string' || !p.trim() || [...p].length > 128)) errors.push('plugin needs one to three default prompts of at most 128 characters');
    const directory = path.join(base, skillDirectory);
    if (fs.readFileSync(path.join(directory, 'SKILL.md'), 'utf8') !== pluginEntry(base)) errors.push('plugin skill entry is stale; run npm run plugin:sync');
    if (fs.readFileSync(path.join(directory, 'agents/openai.yaml'), 'utf8') !== fs.readFileSync(path.join(base, 'agents/openai.yaml'), 'utf8')) errors.push('plugin skill agent metadata is stale; run npm run plugin:sync');
    if (!fs.existsSync(path.resolve(directory, '../../SKILL.md'))) errors.push('plugin entry cannot resolve the main workflow');
  } catch (error) { errors.push(`plugin support: ${error.message}`); }
  return { status: errors.length ? 'fail' : 'pass', errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2];
    if (!['sync', 'check'].includes(command) || process.argv.length > 3) throw new Error('usage: node scripts/plugin-support.mjs sync|check');
    const result = command === 'sync' ? syncPlugin(root) : validatePluginSupport(root);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'pass' ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ status: 'fail', error: error.message }));
    process.exitCode = 1;
  }
}
