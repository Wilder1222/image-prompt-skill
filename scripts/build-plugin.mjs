import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { releaseFiles, validateProject } from './release-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function buildPlugin(base) {
  base = fs.realpathSync(base);
  const validation = validateProject(base);
  if (validation.status !== 'pass') throw new Error(`source validation failed: ${validation.errors.join('; ')}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
  if (pkg.name !== 'image-prompt-skill') throw new Error('unexpected package name');
  const dist = path.join(base, 'dist');
  const parent = path.join(dist, 'codex-plugin');
  const output = path.resolve(parent, pkg.name);
  // This command owns one build directory. Verify every ancestor before recursive removal.
  if (path.dirname(output) !== parent || !path.relative(dist, output) || path.relative(dist, output).startsWith('..')) throw new Error('plugin output must stay inside workspace dist');
  for (const directory of [dist, parent, output]) {
    if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error(`refusing symlink in build path: ${directory}`);
  }
  const files = [...releaseFiles(base), 'RELEASE-MANIFEST.json'];
  if (fs.existsSync(output)) {
    const priorManifest = path.join(output, 'RELEASE-MANIFEST.json');
    if (!fs.existsSync(priorManifest)) throw new Error('existing plugin output has no build manifest; refusing to replace it');
    const prior = JSON.parse(fs.readFileSync(priorManifest, 'utf8'));
    if (prior.name !== pkg.name || !Array.isArray(prior.files) || !prior.sha256) throw new Error('existing output is not a recognized plugin build');
    const knownFiles = [...prior.files, 'RELEASE-MANIFEST.json'].sort();
    const knownDirectories = new Set(knownFiles.flatMap(file => file.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/'))));
    function allFiles(relative = '') {
      return fs.readdirSync(path.join(output, relative), { withFileTypes: true }).flatMap(entry => {
        const name = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw new Error(`refusing symlink in existing output: ${name}`);
        if (!entry.isDirectory()) return [name];
        if (!knownDirectories.has(name)) throw new Error(`existing plugin output contains an unrecognized directory: ${name}`);
        return allFiles(name);
      });
    }
    const actual = allFiles().sort();
    if (JSON.stringify(actual) !== JSON.stringify(knownFiles)) throw new Error('existing plugin output contains unrecognized changes');
    for (const file of prior.files) {
      const digest = crypto.createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex');
      if (digest !== prior.sha256[file]) throw new Error(`existing plugin output was edited: ${file}`);
    }
    fs.rmSync(output, { recursive: true, force: true });
  }
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(output, file)), { recursive: true });
    fs.copyFileSync(path.join(base, file), path.join(output, file));
  }
  const built = validateProject(output);
  if (built.status !== 'pass') throw new Error(`built plugin validation failed: ${built.errors.join('; ')}`);
  const plugin = JSON.parse(fs.readFileSync(path.join(output, '.codex-plugin/plugin.json'), 'utf8'));
  const result = { status: 'pass', name: pkg.name, version: plugin.version, plugin_path: output, file_count: files.length,
    skills: ['skills/image-prompt-skill/SKILL.md'], excluded: ['.git', 'dist', 'node_modules', 'local credentials'] };
  fs.writeFileSync(path.join(dist, 'codex-plugin-build.json'), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) throw new Error('usage: node scripts/build-plugin.mjs');
    console.log(JSON.stringify(buildPlugin(root), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'fail', error: error.message }));
    process.exitCode = 1;
  }
}
