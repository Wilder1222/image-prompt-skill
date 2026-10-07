import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validatePluginSupport } from './plugin-support.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestName = 'RELEASE-MANIFEST.json';
const ignored = new Set(['.git', '.codex', 'node_modules', 'dist', 'coverage', '.DS_Store', 'Thumbs.db', '__pycache__', '.env']);
const ignoredPatterns = ['.env.* (except .env.example)', '*.log', '*.py[cod]'];
const localOutputRoots = new Set(['output']);

export function releaseFiles(base) {
  function walk(dir) {
    return fs.readdirSync(path.join(base, dir), { withFileTypes: true }).flatMap(entry => {
      if (!dir && localOutputRoots.has(entry.name)) return [];
      if (ignored.has(entry.name) || (entry.name.startsWith('.env.') && entry.name !== '.env.example') || entry.name.endsWith('.log') || /\.py[cod]$/.test(entry.name)) return [];
      const relative = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`release cannot include symlink: ${relative}`);
      if (entry.isDirectory()) return walk(relative);
      return relative === manifestName ? [] : [relative];
    });
  }
  return walk('').sort();
}

function snapshot(base) {
  const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
  const files = releaseFiles(base);
  return { name: 'image-prompt-skill', version: pkg.version, manifest_schema: 2,
    excludes: [manifestName, ...ignored, ...ignoredPatterns, ...[...localOutputRoots].map(name => `/${name}/`)].sort(), file_count: files.length, files,
    sha256: Object.fromEntries(files.map(file => [file,
      crypto.createHash('sha256').update(fs.readFileSync(path.join(base, file))).digest('hex')])) };
}

export function validateProject(base, { manifest = true } = {}) {
  const errors = [];
  const files = releaseFiles(base);
  const json = name => JSON.parse(fs.readFileSync(path.join(base, name), 'utf8'));
  for (const file of ['SKILL.md', 'package.json', 'agents/openai.yaml', 'scripts/iteration-director.mjs',
    'scripts/model-adapter.mjs', 'resources/image_model_catalog.json', 'references/providers/text-to-image-models.md', 'examples/text-to-image-brief.json',
    'scripts/asset-master.mjs', 'scripts/character-style-render.mjs', 'scripts/asset-catalog-en.mjs', 'scripts/production-prompt.mjs', 'scripts/production-run.mjs', 'references/core/standing-pose-direction.md', 'references/core/visual-acceptance.md', 'references/routes/prompt-production.md', 'references/routes/asset-master-workflow.md',
    'resources/asset_presentation_v084_catalog.json', 'references/routes/benchmark-costume-refinement.md',
    '.codex-plugin/plugin.json', 'skills/image-prompt-skill/SKILL.md', 'scripts/plugin-support.mjs']) {
    if (!files.includes(file)) errors.push(`missing required file: ${file}`);
  }
  if (files.includes('SKILL.md')) {
    const skill = fs.readFileSync(path.join(base, 'SKILL.md'), 'utf8');
    const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatter || !/^name: image-prompt-skill$/m.test(frontmatter[1]) || !/^description: .+/m.test(frontmatter[1])) errors.push('SKILL.md requires name and description frontmatter');
  }
  // Only current documents are shipped; verify links in every Markdown document.
  for (const file of files.filter(f => f.endsWith('.md'))) {
    const body = fs.readFileSync(path.join(base, file), 'utf8');
    for (const match of body.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1];
      if (/^(?:[a-z]+:|#)/i.test(target)) continue;
      const linked = path.resolve(base, path.dirname(file), decodeURIComponent(target.split('#')[0]));
      if (!fs.existsSync(linked)) errors.push(`${file}: missing linked file ${target}`);
    }
  }
  for (const file of files.filter(f => f.endsWith('.json'))) {
    try { json(file); } catch { errors.push(`invalid JSON: ${file}`); }
  }
  errors.push(...validatePluginSupport(base).errors);
  try {
    const presetCatalog = json('resources/asset_master_pipeline_v082_catalog.json');
    const bindings = {
      face_profile: ['face_profile_v082_catalog.json', 'profiles'],
      proportion_profile: ['fashion_asset_v082_catalog.json', 'profiles'],
      material_profile: ['material_separation_v082_catalog.json', 'profiles'],
      hand_mode: ['hand_pose_v082_catalog.json', 'modes'],
      asset_profile: ['asset_master_v082_catalog.json', 'profiles'],
      lighting_profile: ['studio_lighting_v082_catalog.json', 'profiles'],
      maturity_guard: ['maturity_guard_catalog.json', 'profiles'],
      render_mode: ['render_mode_catalog.json', 'modes'],
    };
    for (const [name, preset] of Object.entries(presetCatalog.presets)) {
      for (const [key, [file, section]] of Object.entries(bindings)) {
        if (!Object.hasOwn(json(`resources/${file}`)[section], preset[key])) errors.push(`${name}: unknown ${key} ${preset[key]}`);
      }
      const face = json('resources/face_profile_v082_catalog.json').profiles[preset.face_profile];
      if (face && face.base_mode !== preset.legacy_face_mode) errors.push(`${name}: legacy face mode disagrees with face profile`);
    }
    const faceCatalog = json('resources/face_profile_v082_catalog.json');
    const workflows = json('resources/asset_style_workflows.json');
    // Inspect the checked directory's data literals without executing its JavaScript.
    const englishSource = fs.readFileSync(path.join(base,'scripts/asset-catalog-en.mjs'),'utf8').replaceAll('\r\n','\n');
    const workflowMarker = 'export const workflowEnglish = ';
    const catalogMarker = 'export const catalogEnglish = ';
    if(!englishSource.includes(workflowMarker)||!englishSource.includes(catalogMarker))throw new Error('missing English compatibility exports');
    const englishWorkflows = JSON.parse(englishSource.slice(englishSource.indexOf(workflowMarker)+workflowMarker.length).trim().replace(/;$/,''));
    const englishEntries = JSON.parse(englishSource.slice(englishSource.indexOf(catalogMarker)+catalogMarker.length,englishSource.indexOf(';\n\nexport function')));
    for(const entry of englishEntries){
      if(!/^[a-z0-9_]+\.json$/.test(entry.resource)||!entry.path.startsWith('$.'))throw new Error('invalid English compatibility source path');
      const value=entry.path.slice(2).replace(/\[(\d+)\]/g,'.$1').split('.').reduce((node,key)=>node?.[key],json(`resources/${entry.resource}`));
      if(value!==entry.zh||typeof entry.en!=='string'||!entry.en.trim())errors.push(`stale English compatibility: ${entry.resource}${entry.path}`);
    }
    if (!Object.hasOwn(workflows.profiles, workflows.default)) errors.push('unknown default asset style workflow');
    for (const [name, workflow] of Object.entries(workflows.profiles)) {
      for (const [field, table] of [['detail_budget','detail_budgets'], ['highlight_hierarchy','highlight_hierarchies'], ['edge_control','edge_controls']]) {
        if (!Object.hasOwn(workflows[table], workflow[field])) errors.push(`${name}: unknown ${field}`);
      }
      if (workflow.appearance) {
        const appearanceFields = ['face','makeup','hair','material','lighting','finish'];
        if (Object.hasOwn(workflow.appearance, 'face_conversion')) appearanceFields.push('face_conversion');
        for (const field of appearanceFields) {
          if (typeof workflow.appearance[field] !== 'string' || !workflow.appearance[field].trim()) errors.push(`${name}: missing appearance ${field}`);
          if (!englishEntries.some(row => row.resource === 'asset_style_workflows.json' && row.path === `$.profiles.${name}.appearance.${field}`)) errors.push(`${name}: missing bound appearance translation ${field}`);
        }
        if (!faceCatalog.profiles[workflow.default_face_profile] || !workflow.allowed_face_profiles?.includes(workflow.default_face_profile) || workflow.allowed_face_profiles.some(id => !faceCatalog.profiles[id])) errors.push(`${name}: invalid compatible face profiles`);
        for (const [field, allowed, table] of [['detail_budget','allowed_detail_budgets','detail_budgets'],['edge_control','allowed_edge_controls','edge_controls'],['highlight_hierarchy','allowed_highlight_hierarchies','highlight_hierarchies']]) {
          if (!Array.isArray(workflow[allowed]) || !workflow[allowed].includes(workflow[field]) || workflow[allowed].some(id => !workflows[table][id])) errors.push(`${name}: invalid compatible ${field}`);
        }
      }
    }
    for (const table of ['profiles','detail_budgets','highlight_hierarchies','edge_controls']) {
      for (const [name, value] of Object.entries(workflows[table])) {
        if (typeof value.zh !== 'string' || !value.zh.trim()) errors.push(`${name}: missing zh visual instructions`);
        const english=englishWorkflows[table]?.[name];
        if(typeof english!=='string'||!english.trim())errors.push(`${name}: missing en visual instructions`);
      }
    }
    const materialCatalog = json('resources/material_separation_v082_catalog.json');
    for (const [name, profile] of Object.entries(materialCatalog.profiles)) {
      for (const key of ['prompt_translation', 'generation_prompt_translation']) {
        if (!Array.isArray(profile[key]) || !profile[key].length || profile[key].some(line => typeof line !== 'string' || !line.trim())) errors.push(`${name}: invalid material ${key}`);
      }
    }
    const modes = json('resources/face_mode_catalog.json').modes;
    const guards = json('resources/maturity_guard_catalog.json').profiles;
    for (const [name, profile] of Object.entries(faceCatalog.profiles)) {
      if (!Object.hasOwn(modes, profile.base_mode)) errors.push(`${name}: unknown base face mode`);
      if (!Object.hasOwn(guards, profile.maturity_guard)) errors.push(`${name}: unknown maturity guard`);
    }
    if (!Object.hasOwn(presetCatalog.presets, presetCatalog.default)) errors.push('unknown default asset preset');
    const presentation = json('resources/asset_presentation_v084_catalog.json');
    for (const mode of ['reference_preserve', 'moderate']) {
      const design = presentation.design_freedoms?.[mode];
      if (!design || typeof design.reference_prompt !== 'string' || !design.reference_prompt.trim() || !Array.isArray(design.prompt_translation) || design.prompt_translation.some(line => typeof line !== 'string' || !line.trim())) errors.push(`invalid design freedom ${mode}`);
    }
    if (!Object.hasOwn(presentation.profiles, presentation.default)) errors.push('unknown default presentation profile');
    for (const [name, profile] of Object.entries(presentation.profiles)) {
      for (const key of ['asset_prompt_translation', 'proportion_prompt_translation', 'generation_prompt_translation']) {
        const value = profile[key];
        if (value === null && key !== 'generation_prompt_translation') continue;
        if (!Array.isArray(value) || value.some(line => typeof line !== 'string' || !line.trim())) errors.push(`${name}: invalid ${key}`);
      }
    }
    for (const mode of ['portrait_expand', 'full_body_anchor']) {
      if (!Object.hasOwn(presentation.reference_modes, mode)) errors.push(`missing reference mode ${mode}`);
    }
    const anchorPrompts = presentation.reference_modes.full_body_anchor?.prompt_translation;
    if (!Array.isArray(anchorPrompts) || !anchorPrompts.length || anchorPrompts.some(line => typeof line !== 'string' || !line.trim())) errors.push('invalid full-body anchor prompts');
    const rounds = json('resources/repair_round_catalog.json').rounds;
    for (const [name, round] of Object.entries(rounds)) {
      if (round.editable.some(id => round.locked.includes(id))) errors.push(`${name}: editable/locked overlap`);
    }
    for (const [name, diagnostic] of Object.entries(json('resources/diagnostic_catalog.v07.json').failures)) {
      // Planning diagnostics repair reference assignments before an image-edit round exists.
      if (!['current_round', 'planning'].includes(diagnostic.round) && !Object.hasOwn(rounds, diagnostic.round)) errors.push(`${name}: unknown repair round ${diagnostic.round}`);
    }
  } catch (error) { errors.push(`catalog validation: ${error.message}`); }
  if (manifest) {
    try {
      const actual = snapshot(base), saved = json(manifestName);
      for (const key of ['name', 'version', 'manifest_schema', 'file_count', 'excludes', 'files']) {
        if (JSON.stringify(actual[key]) !== JSON.stringify(saved[key])) errors.push(`manifest ${key} is stale; run npm run release:build`);
      }
      for (const file of actual.files) if (saved.sha256?.[file] !== actual.sha256[file]) errors.push(`manifest hash mismatch: ${file}`);
      if (Object.keys(saved.sha256 ?? {}).length !== actual.files.length) errors.push('manifest hash inventory is stale');
    } catch (error) { errors.push(`manifest validation: ${error.message}`); }
  }
  return { status: errors.length ? 'fail' : 'pass', errors, checked_files: files.length,
    visual_quality_verified: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2] ?? 'check';
    if (!['build', 'check'].includes(command) || process.argv.length > 3) throw new Error('usage: node scripts/release-check.mjs build|check');
    let report = validateProject(root, { manifest: command !== 'build' });
    if (command === 'build' && report.status === 'pass') {
      fs.writeFileSync(path.join(root, manifestName), `${JSON.stringify(snapshot(root), null, 2)}\n`);
      report = validateProject(root);
    }
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'pass' ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({ status: 'fail', error: error.message }));
    process.exitCode = 1;
  }
}
