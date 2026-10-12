import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt, objectHash, promptHash} from './production-prompt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = path.join(root,'resources/reference_face_presets.json');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

function checkKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`unsupported ${label} fields`);
}

// The registry contains immutable original-file digests, never a locator for a
// generated candidate or a normalized-image digest. The caller supplies the file.
export function listReferenceFacePresets() {
  const registry = JSON.parse(fs.readFileSync(registryPath,'utf8'));
  const entries = Object.entries(registry.presets ?? {}), ids = new Set(entries.map(([id]) => id)), hashes = new Set();
  if (registry.schema_version !== 1 || entries.length !== registry.preset_count || registry.source_images_bundled !== false ||
      registry.candidate_policy?.use !== 'preview_only' || registry.candidate_policy?.may_replace_identity_source !== false)
    throw new Error('invalid fixed reference-face preset registry');
  const aliases = new Set();
  for (const [id,preset] of entries) {
    if (!/^RP-[AB]\d{2}$/.test(id) || !nonempty(preset.title) || !/^[a-f0-9]{64}$/.test(preset.source_sha256) ||
        !Array.isArray(preset.source_record_ids) || !preset.source_record_ids.length || !Array.isArray(preset.aliases) || hashes.has(preset.source_sha256))
      throw new Error(`invalid or duplicate original-file preset ${id}`);
    hashes.add(preset.source_sha256);
    for (const alias of preset.aliases) {
      if (!/^RP-[AB]\d{2}$/.test(alias) || ids.has(alias) || aliases.has(alias)) throw new Error(`invalid or conflicting preset alias ${alias}`);
      aliases.add(alias);
    }
  }
  return registry;
}

export function resolveReferenceFacePreset(presetId) {
  const entries = Object.entries(listReferenceFacePresets().presets);
  const found = entries.find(([id,preset]) => id === presetId || preset.aliases.includes(presetId));
  if (!found) throw new Error(`unknown reference-face preset ${presetId}`);
  return {id:found[0],...found[1]};
}

// Production freeze computes content_sha256 from actual bytes before calling
// this function. Snapshot verification rechecks this binding and the file hash.
// Calling it on synthetic metadata does not inspect a file or approve an image.
export function assertReferenceFacePresetBindings(references) {
  if (!Array.isArray(references)) throw new Error('reference bindings need an array');
  const selected = references.filter(ref => typeof ref?.identity_target_id === 'string' && ref.identity_target_id.startsWith('RP-'));
  if (!selected.length) return;
  const identities = references.filter(ref => ref.authority?.includes('identity'));
  if (selected.length !== 1 || identities.length !== 1 || identities[0] !== selected[0])
    throw new Error('reference-face preset requires exactly one original identity authority; other identities cannot be mixed');
  const ref = selected[0], preset = resolveReferenceFacePreset(ref.identity_target_id);
  if (ref.identity_target_id !== preset.id) throw new Error(`reference-face identity target must use canonical preset id ${preset.id}`);
  if (ref.inspected !== true || ref.generation_input !== true || (ref.identity_role !== undefined && ref.identity_role !== 'primary'))
    throw new Error('reference-face original must be inspected, a primary identity authority and an actual generation_input');
  if (ref.content_sha256 !== preset.source_sha256)
    throw new Error(`reference-face preset ${preset.id} requires the exact original file bytes; candidates and normalized hashes cannot replace its identity source`);
}

export function applyReferenceFacePreset(brief, selection, options = {}) {
  checkKeys(selection,['preset_id','reference_id'],'reference-face selection');
  checkKeys(options,['base_dir'],'reference-face options');
  if (!nonempty(selection.preset_id) || !nonempty(selection.reference_id)) throw new Error('reference-face selection needs preset_id and reference_id');
  if (options.base_dir !== undefined && !nonempty(options.base_dir)) throw new Error('base_dir must be a directory path');
  if (brief?.subject_kind !== 'character') throw new Error('reference-face preset requires an authored character brief');
  compileProductionPrompt(brief);
  const preset = resolveReferenceFacePreset(selection.preset_id), next = structuredClone(brief);
  const identities = next.references.filter(ref => ref.authority.includes('identity'));
  const ref = next.references.find(row => row.id === selection.reference_id);
  if (!ref || identities.length !== 1 || identities[0] !== ref)
    throw new Error('selected original must be the only identity authority in the brief');
  if (ref.inspected !== true || ref.generation_input !== true || (ref.identity_role !== undefined && ref.identity_role !== 'primary'))
    throw new Error('selected original must be inspected, primary and an actual generation_input');
  if (ref.identity_target_id !== undefined && ref.identity_target_id !== preset.id && !preset.aliases.includes(ref.identity_target_id))
    throw new Error('existing identity_target_id conflicts with the selected original reference-face preset');
  const source = path.resolve(options.base_dir ?? process.cwd(),ref.source);
  const digest = promptHash(fs.readFileSync(source));
  // Validate an ephemeral byte receipt; content_sha256 is owned by freeze and
  // must not be added to the authored production reference schema.
  ref.identity_target_id = preset.id;
  ref.identity_role = 'primary';
  ref.source = source;
  assertReferenceFacePresetBindings(next.references.map(row => row === ref ? {...row,content_sha256:digest} : row));
  const position = next.references.filter(row => row.generation_input).findIndex(row => row.id === ref.id) + 1;
  const id = `RP:${preset.id}:source`;
  const text = `以输入图${position}为唯一人物身份基准，保持其实际可辨认的五官关系与表观年龄，仅按本轮允许范围改变呈现；未清楚显示的部位不声明精确复刻。`;
  const requirement = {id,channel:'identity',priority:'must',text};
  const criterion = {id:`${id}:check`,basis:id,critical:true,question:'实际可辨认的脸型、眉眼、鼻唇与年龄观感是否保持原图本人，且未将未知结构当作已确认事实？'};
  const prior = next.requirements.find(row => row.id === id);
  if (prior) {
    if (objectHash(prior) !== objectHash(requirement) || !next.acceptance.some(row => objectHash(row) === objectHash(criterion)) ||
        !next.sections.some(section => section.channel === 'identity' && section.items.some(item => item.text === text && item.basis.includes(id))))
      throw new Error('existing reference-face source contract conflicts with the selected original');
  } else {
    if (next.acceptance.some(row => row.id === criterion.id)) throw new Error('reference-face acceptance id conflicts with the existing brief');
    next.requirements.push(requirement);
    next.acceptance.push(criterion);
    const item = {text,basis:[id],intent:'constraint'};
    const section = next.sections.find(row => row.label === '原图身份基准');
    if (section && section.channel !== 'identity') throw new Error('original identity section label conflicts with another channel');
    if (section) section.items.push(item);
    else next.sections.push({label:'原图身份基准',channel:'identity',items:[item]});
  }
  compileProductionPrompt(next);
  return next;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2], options = {};
    for (let i=3;i<process.argv.length;i+=2) {
      const key = process.argv[i];
      if (!['--preset','--reference','--brief','--out'].includes(key) || !process.argv[i+1] || Object.hasOwn(options,key)) throw new Error('invalid reference-face CLI options');
      options[key] = process.argv[i+1];
    }
    if (command === 'list' && Object.keys(options).length) throw new Error('list does not accept options');
    if (!['list','apply'].includes(command) || (command === 'apply' && (!options['--preset'] || !options['--reference'] || !options['--brief'])))
      throw new Error('usage: reference-face-presets.mjs list | apply --preset RP-A01 --reference R1 --brief brief.json [--out bound.brief.json]');
    const result = command === 'list' ? listReferenceFacePresets() : applyReferenceFacePreset(
      JSON.parse(fs.readFileSync(options['--brief'],'utf8')),{preset_id:options['--preset'],reference_id:options['--reference']},
      {base_dir:path.dirname(path.resolve(options['--brief']))});
    if (options['--out']) {
      const out = path.resolve(options['--out']);
      fs.mkdirSync(path.dirname(out),{recursive:true});
      fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
    } else console.log(JSON.stringify(result,null,2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
