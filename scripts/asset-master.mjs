import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTaggedChinese } from './asset-prompt-zh.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'resources', name), 'utf8'));
const presets = read('asset_master_pipeline_v082_catalog.json');
const faces = read('face_profile_v082_catalog.json');
const proportions = read('fashion_asset_v082_catalog.json');
const materials = read('material_separation_v082_catalog.json');
const hands = read('hand_pose_v082_catalog.json');
const assets = read('asset_master_v082_catalog.json');
const lights = read('studio_lighting_v082_catalog.json');
const guards = read('maturity_guard_catalog.json');
const rounds = read('repair_round_catalog.json');
const presentations = read('asset_presentation_v084_catalog.json');
const workflows = read('asset_style_workflows.json');

function lookup(table, id, label) {
  if (typeof id !== 'string' || !Object.hasOwn(table, id)) throw new Error(`unknown ${label}: ${id}`);
  return table[id];
}

const scopes = {
  face: {
    round: 'asset_master_face_refine',
    preserve: 'Preserve the exact facial identity geometry and apparent age, body proportions, hairstyle, costume design, pose, hands, footwear, framing, background and lighting layout.',
    change: 'Change only facial rendering: retain the observed eyelids, cheek volume and mouth-corner placement while adjusting skin response and facial realism.',
  },
  structure: {
    round: 'asset_master_structure_refine',
    preserve: 'Preserve facial identity, apparent age, approved facial rendering, hairstyle, costume design, palette, materials, background type and lighting layout.',
    change: 'Change only full-body proportion cues, hand anatomy, footwear readability and framing; retain the costume construction.',
  },
  'material-light': {
    round: 'asset_master_material_light_refine',
    preserve: 'Preserve facial identity, apparent age and approved facial rendering, body proportions, hairstyle, pose, hands, footwear shape, costume construction, palette and framing.',
    change: 'Change only garment material response, studio lighting, pale-fabric edge separation and floor contact shadow.',
  },
};

export function createAssetPlan(options = {}) {
  const allowed = ['preset', 'faceProfile', 'handMode', 'maturityGuard', 'presentation', 'proportionProfile', 'designFreedom', 'styleWorkflow', 'detailBudget', 'highlightHierarchy', 'edgeControl', 'passed'];
  for (const key of Object.keys(options)) if (!allowed.includes(key)) throw new Error(`unknown asset option: ${key}`);
  const preset = options.preset ?? presets.default;
  const configuration = { ...lookup(presets.presets, preset, 'asset preset') };
  configuration.face_profile = options.faceProfile ?? configuration.face_profile;
  configuration.hand_mode = options.handMode ?? configuration.hand_mode;
  configuration.proportion_profile = options.proportionProfile ?? configuration.proportion_profile;
  // Face realism never implicitly changes the age target, including during A/B tests.
  configuration.maturity_guard = options.maturityGuard ?? configuration.maturity_guard;
  configuration.presentation_profile = options.presentation ?? presentations.default;
  configuration.design_freedom = options.designFreedom ?? 'reference_preserve';
  configuration.style_workflow = options.styleWorkflow ?? workflows.default;
  const workflow = lookup(workflows.profiles, configuration.style_workflow, 'style workflow');
  configuration.detail_budget = options.detailBudget ?? workflow.detail_budget;
  configuration.highlight_hierarchy = options.highlightHierarchy ?? workflow.highlight_hierarchy;
  configuration.edge_control = options.edgeControl ?? workflow.edge_control;
  const styleRendering = {
    workflow,
    detail: lookup(workflows.detail_budgets, configuration.detail_budget, 'detail budget'),
    highlights: lookup(workflows.highlight_hierarchies, configuration.highlight_hierarchy, 'highlight hierarchy'),
    edges: lookup(workflows.edge_controls, configuration.edge_control, 'edge control'),
  };
  if (configuration.style_workflow === 'dark_fantasy_asset' && ['humanized_real_light', 'humanized_real_full'].includes(configuration.face_profile)) {
    throw new Error('dark_fantasy_asset preserves a painted face; use a beauty_first or stylized_beauty profile, or explicitly switch style workflow');
  }
  const designFreedom = lookup(presentations.design_freedoms, configuration.design_freedom, 'design freedom');
  const presentation = lookup(presentations.profiles, configuration.presentation_profile, 'presentation profile');
  const face = lookup(faces.profiles, configuration.face_profile, 'face profile');
  configuration.legacy_face_mode = face.base_mode;
  const guard = lookup(guards.profiles, configuration.maturity_guard, 'maturity guard');
  const hand = lookup(hands.modes, configuration.hand_mode, 'hand mode');
  let fashion = lookup(proportions.profiles, configuration.proportion_profile, 'proportion profile');
  if (presentation.proportion_prompt_translation) {
    fashion = { ...fashion, prompt_translation: [...fashion.prompt_translation, ...presentation.proportion_prompt_translation] };
  }
  const material = lookup(materials.profiles, configuration.material_profile, 'material profile');
  let asset = lookup(assets.profiles, configuration.asset_profile, 'asset profile');
  if (presentation.asset_prompt_translation) {
    asset = { aspect_ratio: '3:4', background: 'clean_white_seamless', requirements: ['complete_silhouette', 'readable_shoe_contact', 'reference_derived_hem'], prompt_translation: presentation.asset_prompt_translation };
    configuration.asset_profile = `presentation:${configuration.presentation_profile}`;
  }
  const light = lookup(lights.profiles, configuration.lighting_profile, 'lighting profile');
  const passed = options.passed ?? [];
  if (!Array.isArray(passed) || passed.some(x => typeof x !== 'string')) throw new Error('passed must be an array of dimension or round names');
  const known = new Set(Object.entries(rounds.rounds).flatMap(([id, r]) => [id, ...r.editable, ...r.locked]));
  for (const id of passed) if (!known.has(id)) throw new Error(`unknown passed dimension: ${id}`);

  function stage(name, prompts, data, requires = []) {
    const scope = scopes[name];
    const round = rounds.rounds[scope.round];
    const conflicts = passed.filter(id => round.editable.includes(id) || id === scope.round);
    return {
      status: conflicts.length ? 'blocked_by_locks' : 'planned',
      blocked_by_passed: conflicts, requires_accepted_rounds: requires,
      round_plan: {
        round: scope.round,
        editable: round.editable.filter(id => !passed.includes(id)),
        locked: [...new Set([...round.locked, ...passed])],
        forbidden: round.forbidden,
        prompt_strategy: scope.change,
      },
      ...data,
      prompt_skeleton: conflicts.length ? [] : [
        'Edit the supplied current asset image. Use it as the only direct edit target.',
        scope.preserve, scope.change, ...prompts,
      ],
    };
  }
  const stage1 = stage('face', [...face.prompt_translation, ...guard.prompt_translation], {
    face_profile: { profile: configuration.face_profile, ...face,
      // Catalog ages are historical defaults; the selected guard is the effective target.
      age_range: guard.enabled ? `${guard.age_floor}_${guard.age_ceiling}` : 'preserve_reference',
      maturity_guard: configuration.maturity_guard },
  });
  const stage2 = stage('structure', [...asset.prompt_translation, ...fashion.prompt_translation, ...hand.prompt_translation], {
    fashion_asset: { profile: configuration.proportion_profile, ...fashion },
    hand_pose: { mode: configuration.hand_mode, ...hand },
    asset_master: { profile: configuration.asset_profile, ...asset },
  }, ['asset_master_face_refine']);
  const stage3 = stage('material-light', [...material.prompt_translation, ...light.prompt_translation], {
    material_separation: { profile: configuration.material_profile, ...material },
    studio_lighting: { profile: configuration.lighting_profile, ...light },
  }, ['asset_master_face_refine', 'asset_master_structure_refine']);
  return {
    preset, configuration, style_rendering: styleRendering, status: 'planned', priority: presets.priority,
    presentation: { profile: configuration.presentation_profile, ...presentation },
    design_freedom: { mode: configuration.design_freedom, ...designFreedom },
    stage_1: stage1, stage_2: stage2, stage_3: stage3,
    order: [scopes.face.round, scopes.structure.round, scopes['material-light'].round, configuration.style_workflow === 'dark_fantasy_asset' ? 'final_style_review' : 'final_photographic_polish', 'upscale'],
    rule: 'Use only the failed stage; accept its actual image before progressing. A plan is not evidence that any image has passed. Preserve approved face rendering during non-face repairs.',
  };
}

export function compileAssetPrompt({ stage = 'generate', focus, referenceMode = 'portrait_expand', language = 'zh-CN', ...options } = {}) {
  if (!['en', 'zh-CN'].includes(language)) throw new Error('language must be zh-CN or en');
  const finish = result => ({ ...result, status:'scaffold_only', requires_reference_analysis:true, prompt_language: language, prompt: language === 'zh-CN' ? renderTaggedChinese(result) : (result.prompt.startsWith('【') ? result.prompt : result.prompt.split('\n\n').map((text, i) => `【${i + 1}. ${i ? 'Preservation and edit scope' : 'Task and reference'}】\n${text}`).join('\n\n')) });
  const reference = lookup(presentations.reference_modes, referenceMode, 'reference mode');
  if (referenceMode === 'full_body_anchor') {
    if (stage !== 'generate' || focus || options.passed?.length) throw new Error('full_body_anchor is a preservation generation mode; for a local repair use the edit stage with the current image as its target');
    const overrides = ['preset', 'faceProfile', 'handMode', 'maturityGuard', 'presentation', 'proportionProfile', 'designFreedom', 'styleWorkflow', 'detailBudget', 'highlightHierarchy', 'edgeControl'].filter(key => options[key] !== undefined);
    if (overrides.length) throw new Error(`full_body_anchor preserves its design; conflicting profile overrides: ${overrides.join(', ')}; use an explicit edit stage to change an attribute`);
    // Validate unknown keys without applying the preset's pose, age or proportions.
    createAssetPlan(options);
    return finish({
      status: 'prompt_ready', stage, focus: null, reference_mode: referenceMode,
      configuration: { face_profile: 'preserve_reference', maturity_guard: 'none', hand_mode: 'preserve_reference',
        proportion_profile: 'preserve_reference', presentation_profile: 'preserve_reference',
        material_profile: 'preserve_reference', lighting_profile: 'preserve_reference' },
      round_plan: null, prompt: reference.prompt_translation.join('\n\n'),
      evidence: { image_generated: false, visual_quality_verified: false },
    });
  }
  if (stage !== 'generate' && options.designFreedom !== undefined) throw new Error('designFreedom is for new generation; a local edit cannot reopen costume design');
  const plan = createAssetPlan(options);
  const stages = { face: plan.stage_1, structure: plan.stage_2, 'material-light': plan.stage_3 };
  const focuses = {
    hands: { stage: 'structure', dimensions: ['hand_pose_integrity'], prompts: [
      'Each hand has one thumb and four fingers anatomically. Preserve natural occlusion; only visible segments need to be resolved. Correct fused or duplicated visible digits and incoherent knuckle/wrist connections without forcing hidden fingers into view.',
    ],
      preserve: 'Keep body proportions, garment drape, framing and footwear unchanged. Repair only the hands and their wrist/sleeve contact locally, retaining the existing gesture.' },
    proportion: { stage: 'structure', dimensions: ['fashion_asset_proportion', 'garment_verticality'], prompts: plan.stage_2.fashion_asset.prompt_translation,
      preserve: 'Keep hands, gesture, footwear design and camera framing unchanged. Adjust only body proportion cues and existing garment verticality.' },
    framing: { stage: 'structure', dimensions: ['asset_framing', 'footwear_readability'], prompts: plan.stage_2.asset_master.prompt_translation,
      preserve: 'Keep body proportions, hand anatomy, pose and costume design unchanged. Adjust only framing and garment occlusion around the existing shoes, without redesigning them.' },
    materials: { stage: 'material-light', dimensions: ['material_separation', 'material_highlight_balance'], prompts: plan.stage_3.material_separation.prompt_translation,
      preserve: 'Keep the current light positions, background and floor shadow unchanged. Refine only the response of materials already present.' },
    lighting: { stage: 'material-light', dimensions: ['studio_light_separation', 'white_background_readability', 'floor_contact_shadow'], prompts: plan.stage_3.studio_lighting.prompt_translation,
      preserve: 'Keep the existing garment materials and textures unchanged. Refine only studio illumination, pale-edge separation and contact shadow.' },
  };
  let lines, roundPlan = null;
  if (stage === 'generate') {
    if (focus || options.passed?.length) throw new Error('focus and passed locks require an edit stage');
    const c = plan.configuration, s = plan.style_rendering;
    const section = (label, items) => `【${label}】\n${items.map(text => text.trim()).filter(Boolean).join('\n')}`;
    lines = [
      section('Task and reference', ['Create a 3:4 full-body front-facing white-background ancient-fantasy character asset from the supplied reference.', plan.design_freedom.reference_prompt]),
      section('Mode settings', [`render mode = ${c.render_mode}`, `style workflow = ${c.style_workflow}`, `face mode = ${c.legacy_face_mode}`, `proportion mode = ${c.proportion_profile === 'P9_FASHION_ASSET' ? 'P9 Fashion' : 'Natural Adult'}`, `detail budget = ${c.detail_budget}`, `highlight hierarchy = ${c.highlight_hierarchy}`, `edge control = ${c.edge_control}`]),
      section('Core goal', [s.workflow.en]),
      section('1. Identity and face', plan.stage_1.prompt_skeleton.slice(3)),
      section('2. Makeup and skin', [c.style_workflow === 'dark_fantasy_asset' ? 'Retain refined painted makeup and facial beauty. Do not add documentary pores, age or fatigue to force photographic realism.' : 'Use sheer makeup, soft brows and restrained lip color; preserve mild natural skin texture and region-specific reflection, avoiding plastic smoothing and coarse documentary aging.']),
      section('3. Hair and ornaments', ['Keep the actual reference hairstyle direction, hair color, primary silhouette and signature ornaments. Resolve individual hair groups without replacing the hairstyle with another character template.']),
      section('4. Costume design', [plan.design_freedom.reference_prompt, ...plan.design_freedom.prompt_translation, ...plan.presentation.generation_prompt_translation]),
      section('5. Material response', [...plan.stage_3.material_separation.generation_prompt_translation, s.detail.en]),
      section('6. Composition and pose', [...plan.stage_2.asset_master.prompt_translation, ...plan.stage_2.hand_pose.prompt_translation]),
      section('7. Body proportion', plan.stage_2.fashion_asset.prompt_translation),
      section('8. Hands and feet', ['Each hand anatomically has one thumb and four fingers; natural overlap is allowed. Keep wrists and visible joints coherent. Include matching footwear and floor contact; do not crop the feet or force the entire shoe out from under a naturally long hem.']),
      section('9. Background and light', [...plan.stage_3.studio_lighting.prompt_translation, s.highlights.en, s.edges.en, 'Remove scenic branches, bokeh, sunset atmosphere, foreground obstructions and battlefield effects. Keep only a white seamless background and a faint contact shadow.']),
      section('10. Final goal and restrictions', [s.workflow.en, 'A complete, centered, front-facing asset with beautiful readable face, coherent tall proportions and distinct garment materials. No half-body crop, large twist, exaggerated action or forced perspective.']),
    ];
  } else {
    const selected = lookup(stages, stage, 'edit stage');
    const selectedFocus = focus ? lookup(focuses, focus, 'edit focus') : null;
    if (selectedFocus && selectedFocus.stage !== stage) throw new Error(`focus ${focus} requires stage ${selectedFocus.stage}`);
    const original = rounds.rounds[selected.round_plan.round];
    const editable = selectedFocus?.dimensions ?? original.editable;
    const conflicts = (options.passed ?? []).filter(id => editable.includes(id) || id === selected.round_plan.round);
    if (conflicts.length) throw new Error(`edit would reopen passed dimensions: ${conflicts.join(', ')}; choose a narrower focus or explicitly remove the conflicting lock`);
    roundPlan = { ...selected.round_plan, editable, prompt_strategy: selectedFocus?.preserve ?? selected.round_plan.prompt_strategy,
      locked: [...new Set([...selected.round_plan.locked, ...original.editable.filter(id => !editable.includes(id))])] };
    lines = selectedFocus
      ? ['Edit the supplied current asset image. Use it as the only direct edit target.', scopes[stage].preserve, selectedFocus.preserve, ...selectedFocus.prompts]
      : selected.prompt_skeleton;
    if (options.passed?.length) lines = [...lines, `Also preserve these accepted dimensions: ${options.passed.map(id => id.replaceAll('_', ' ')).join(', ')}.`];
    // Keep localized repairs within their existing scope; a style selection cannot restyle an accepted master.
    if (plan.configuration.style_workflow === 'dark_fantasy_asset') lines.push('Preserve the existing painted concept-art medium and selective brushwork; this local repair must not convert the asset into a photograph.');
  }
  // Keep the user-requested mode header, and translate catalog shorthand in visual clauses.
  lines = lines.map(line => line.replaceAll('P9 fashion-asset proportion', 'tall, balanced fashion proportion with an approximately nine-head visual read'));
  return finish({ status: 'prompt_ready', stage, focus: focus ?? null, reference_mode: referenceMode, configuration: plan.configuration, style_rendering: plan.style_rendering,
    round_plan: roundPlan, prompt: [...new Set(lines)].join('\n\n'),
    evidence: { image_generated: false, visual_quality_verified: false } });
}
