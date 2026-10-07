import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderTaggedChinese } from './asset-prompt-zh.mjs';
import { translateCatalogToEnglish, workflowEnglish } from './asset-catalog-en.mjs';
import { applyCharacterAppearance } from './character-style-render.mjs';

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

export function resolvePassedLocks(requested = []) {
  if (!Array.isArray(requested) || requested.some(x => typeof x !== 'string')) throw new Error('passed must be an array of dimension or round names');
  const known = new Set(Object.entries(rounds.rounds).flatMap(([id, r]) => [id, ...r.editable, ...r.locked]));
  for (const id of requested) if (!known.has(id)) throw new Error(`unknown passed dimension: ${id}`);
  const resolved = new Set(requested);
  // Accepting a round protects its editable dimensions; its inherited locks are
  // not new evidence that those other dimensions have independently passed.
  for (const id of requested) for (const dimension of rounds.rounds[id]?.editable ?? []) resolved.add(dimension);
  // These names refer to the same body-proportion scope in the older planner,
  // face repair locks and current asset stages. Do not infer aliases by spelling.
  const body = ['body_proportion', 'fashion_proportion', 'fashion_asset_proportion'];
  if (body.some(id => resolved.has(id))) for (const id of body) resolved.add(id);
  return [...resolved];
}

const scopes = {
  face: {
    round: 'asset_master_face_refine',
    preserve: '保留既有面容几何与表观年龄、身体比例、发型、服装、姿态、手脚、取景、背景和布光。',
    change: '仅调整面部表现：保留已观察的眼睑、面颊体积与嘴角位置，修订肤质反射和真人程度。',
    enPreserve: 'Preserve the exact facial identity geometry and apparent age, body proportions, hairstyle, costume design, pose, hands, footwear, framing, background and lighting layout.',
    enChange: 'Change only facial rendering: retain the observed eyelids, cheek volume and mouth-corner placement while adjusting skin response and facial realism.',
  },
  structure: {
    round: 'asset_master_structure_refine',
    preserve: '保留人物身份与年龄、已认可面部表现、发型、服装构造配色、材料、背景类型与灯位。',
    change: '仅调整全身比例关系、可见手部结构和取景，保持服装构造；鞋履是否需展示由任务决定。',
    enPreserve: 'Preserve facial identity, apparent age, approved facial rendering, hairstyle, costume design, palette, materials, background type and lighting layout.',
    enChange: 'Change only full-body proportion cues, hand anatomy, footwear readability and framing; retain the costume construction.',
  },
  'material-light': {
    round: 'asset_master_material_light_refine',
    preserve: '保留人物身份、年龄与已认可面部表现、身体比例、发型、姿态、手脚鞋形、服装构造配色及取景。',
    change: '仅调整服装材质反应、棚拍照明、浅色衣缘分离及符合姿态的接地阴影。',
    enPreserve: 'Preserve facial identity, apparent age and approved facial rendering, body proportions, hairstyle, pose, hands, footwear shape, costume construction, palette and framing.',
    enChange: 'Change only garment material response, studio lighting, pale-fabric edge separation and floor contact shadow.',
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
  if (configuration.proportion_profile !== 'P9_FASHION_ASSET') throw new Error('人物资产必须采用黄金九头身比例：P9_FASHION_ASSET；不支持自然七头身或其他比例替代');
  // Face realism never implicitly changes the age target, including during A/B tests.
  configuration.maturity_guard = options.maturityGuard ?? configuration.maturity_guard;
  configuration.presentation_profile = options.presentation ?? presentations.default;
  configuration.design_freedom = options.designFreedom ?? 'reference_preserve';
  configuration.style_workflow = options.styleWorkflow ?? workflows.default;
  const workflow = lookup(workflows.profiles, configuration.style_workflow, 'style workflow');
  const appearance = workflow.appearance;
  if (appearance) {
    configuration.face_profile = options.faceProfile ?? workflow.default_face_profile;
    configuration.maturity_guard = options.maturityGuard ?? 'none';
    if (!workflow.allowed_face_profiles.includes(configuration.face_profile)) throw new Error('face profile conflicts with selected character medium; use its compatible face profile or author an explicit hybrid brief');
  }
  configuration.detail_budget = options.detailBudget ?? workflow.detail_budget;
  configuration.highlight_hierarchy = options.highlightHierarchy ?? workflow.highlight_hierarchy;
  configuration.edge_control = options.edgeControl ?? workflow.edge_control;
  if (appearance) {
    for (const [field, allowed] of [['detail_budget','allowed_detail_budgets'], ['edge_control','allowed_edge_controls'], ['highlight_hierarchy','allowed_highlight_hierarchies']]) {
      if (!workflow[allowed].includes(configuration[field])) throw new Error(`${field} conflicts with selected character medium; author an explicit hybrid brief instead of mixing incompatible presets`);
    }
  }
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
  if (appearance) styleRendering.age_guard = guard;
  const hand = lookup(hands.modes, configuration.hand_mode, 'hand mode');
  let fashion = lookup(proportions.profiles, configuration.proportion_profile, 'proportion profile');
  if (presentation.proportion_prompt_translation) {
    fashion = { ...fashion, prompt_translation: [...fashion.prompt_translation, ...presentation.proportion_prompt_translation] };
  }
  let material = lookup(materials.profiles, configuration.material_profile, 'material profile');
  if (appearance) material = {...material, prompt_translation:[appearance.material], generation_prompt_translation:[appearance.material]};
  let asset = lookup(assets.profiles, configuration.asset_profile, 'asset profile');
  if (presentation.asset_prompt_translation) {
    asset = { aspect_ratio: '3:4', background: 'clean_white_seamless', requirements: ['complete_silhouette', 'readable_shoe_contact', 'reference_derived_hem'], prompt_translation: presentation.asset_prompt_translation };
    configuration.asset_profile = `presentation:${configuration.presentation_profile}`;
  }
  let light = lookup(lights.profiles, configuration.lighting_profile, 'lighting profile');
  if (appearance) light = {...light, prompt_translation:[appearance.lighting]};
  const passed = resolvePassedLocks(options.passed);

  function stage(name, prompts, data, requires = []) {
    const scope = appearance && name === 'face' ? {...scopes[name], change:'仅修订当前媒介下的面部表现与妆面，不更换人物身份、年龄或整体风格。'} : scopes[name];
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
        '编辑提供的当前资产图，将其作为唯一直接编辑对象。',
        scope.preserve, scope.change, ...prompts,
      ],
    };
  }
  const stage1 = stage('face', [...(appearance ? [appearance.face, appearance.makeup] : face.prompt_translation), ...guard.prompt_translation], {
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
    preset, configuration, style_rendering: styleRendering, status: 'planned', priority: presets.priority, accepted_locks: passed,
    presentation: { profile: configuration.presentation_profile, ...presentation },
    design_freedom: { mode: configuration.design_freedom, ...designFreedom },
    stage_1: stage1, stage_2: stage2, stage_3: stage3,
    order: [scopes.face.round, scopes.structure.round, scopes['material-light'].round, configuration.style_workflow === 'dark_fantasy_asset' || (appearance && workflow.family !== 'photographic') ? 'final_style_review' : 'final_photographic_polish', 'upscale'],
    rule: '只处理未通过的阶段，查看实际输出后再推进；计划不代表图像通过。非面部修订保留已认可的面部表现。',
  };
}

// Explicit English compatibility rendering stays in executable code; resource prose is Chinese.
const englishStudioLighting = [
  'For this white studio setup, use a large diffused key close to the camera axis and slightly above, with enough broad frontal fill for even forehead, eye and cheek exposure. Keep neutral white balance and subtle edge separation. Remove inherited dappled scene light, window patterns, hard hair shadows and warm color casts.',
  'Retain gentle facial volume under even lighting. Skin detail serves refined makeup and framing. Keep the white background from swallowing pale garment edges, shadows consistent with the pose, distinct fabric layers and restrained metal highlights. Preserve the requested photographic or painterly medium.'
];
function renderEnglishCompatibility(prompt) {
  const localized = lights.profiles.studio_soft_separation.prompt_translation.reduce((text, source, i) => text.replaceAll(source, englishStudioLighting[i]), prompt);
  const scopesRendered = Object.values(scopes).reduce((text, scope) => text.replaceAll(scope.preserve,scope.enPreserve).replaceAll(scope.change,scope.enChange), localized).replaceAll('编辑提供的当前资产图，将其作为唯一直接编辑对象。','Edit the supplied current asset image. Use it as the only direct edit target.');
  return translateCatalogToEnglish(scopesRendered).replaceAll('仅修订当前媒介下的面部表现与妆面，不更换人物身份、年龄或整体风格。', 'Refine the face and makeup within the current medium without changing identity, age or overall style.').replaceAll('P9 fashion-asset proportion', 'mandatory balanced nine-head body proportions');
}

export function compileAssetPrompt({ stage = 'generate', focus, referenceMode = 'portrait_expand', language = 'zh-CN', ...options } = {}) {
  if (!['en', 'zh-CN'].includes(language)) throw new Error('language must be zh-CN or en');
  const finish = result => {
    if (language === 'en') result = {...result, prompt:renderEnglishCompatibility(result.prompt)};
    const prompt = language === 'zh-CN' ? renderTaggedChinese(result) : (result.prompt.startsWith('【') ? result.prompt : result.prompt.split('\n\n').map((text, i) => `【${i ? 'Preservation and edit scope' : 'Task and reference'}】\n${text}`).join('\n\n'));
    return {...result, status:'scaffold_only', requires_reference_analysis:true, prompt_language:language, prompt:applyCharacterAppearance(prompt, result, language)};
  };
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
        proportion_profile: 'P9_FASHION_ASSET', presentation_profile: 'preserve_reference',
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
      section('Core goal', [workflowEnglish.profiles[c.style_workflow]]),
      section('Identity and face', plan.stage_1.prompt_skeleton.slice(3)),
      section('Expression and gaze', ['Allow the expression to adapt to the current character, pose, setting and purpose while retaining facial identity and apparent age. Select coherent gaze, brow and eyelid tension, mouth-corner movement and lip opening; do not freeze the original expression or impose a universal smile. Explicit expression and gaze requirements take precedence. Natural expression movement is allowed without redesigning the face or changing a locked head angle.']),
      section('Makeup and skin', [c.style_workflow === 'dark_fantasy_asset' ? 'Retain refined painted makeup and facial beauty. Skin detail serves the finished makeup and visual appeal; do not add documentary pores, age or fatigue to force photographic realism.' : 'Establish refined, character-appropriate makeup and an attractive finished face first. Use finely blended foundation, coordinated eyes and lips, soft regional reflection and restrained skin texture to support that finish. Scale detail to framing without forcing visible pores at full-body size; avoid coarse sharpening, patchy makeup and plastic smoothing.']),
      section('Hair and ornaments', ['Keep the reference hair color, overall hairstyle direction, primary silhouette and signature ornaments. Allow the parting, temple strands and local fastening to adapt for a clear face: substantially reduce stray hair crossing the forehead, eyes, nose, mouth and cheeks; retain only sparse silhouette wisps and natural volume. Do not force strand-for-strand copying or slick all hair flat. Explicit user requests to preserve a particular fringe or ornament take precedence.']),
      section('Costume design', [plan.design_freedom.reference_prompt, ...plan.design_freedom.prompt_translation, ...plan.presentation.generation_prompt_translation]),
      section('Material response', [...plan.stage_3.material_separation.generation_prompt_translation, workflowEnglish.detail_budgets[c.detail_budget]]),
      section('Composition and pose', [...plan.stage_2.asset_master.prompt_translation, ...plan.stage_2.hand_pose.prompt_translation]),
      section('Body proportion', plan.stage_2.fashion_asset.prompt_translation),
      section('Hands and feet', ['Each hand anatomically has one thumb and four fingers; natural overlap is allowed. Keep visible joints coherent. The stance and garment gravity determine whether one, both or neither foot is visible. Keep the complete natural silhouette inside the frame and plausible ground contact; do not lift or shorten the hem to force visible shoe tips.']),
      section('Background and light', [...plan.stage_3.studio_lighting.prompt_translation, workflowEnglish.highlight_hierarchies[c.highlight_hierarchy], workflowEnglish.edge_controls[c.edge_control], 'Remove scenic branches, bokeh, sunset atmosphere, foreground obstructions and battlefield effects. Keep only a white seamless background and a faint contact shadow.']),
      section('Final goal and restrictions', [workflowEnglish.profiles[c.style_workflow], 'For this neutral front-facing inspection case, keep a complete centered figure, readable face, coherent proportions and distinct garment materials. Exaggerated or dynamic action is supported by the production workflow when selected for the task; do not apply this static case as a universal movement restriction. Express life through focused gaze, coherent facial and body intent, natural shoulder and hand tension, and believable cloth response.']),
    ];
  } else {
    const selected = lookup(stages, stage, 'edit stage');
    const selectedFocus = focus ? lookup(focuses, focus, 'edit focus') : null;
    if (selectedFocus && selectedFocus.stage !== stage) throw new Error(`focus ${focus} requires stage ${selectedFocus.stage}`);
    const original = rounds.rounds[selected.round_plan.round];
    const editable = selectedFocus?.dimensions ?? original.editable;
    const conflicts = plan.accepted_locks.filter(id => editable.includes(id) || id === selected.round_plan.round);
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
  lines = lines.map(line => line.replaceAll('P9 fashion-asset proportion', 'mandatory balanced nine-head body proportions'));
  return finish({ status: 'prompt_ready', stage, focus: focus ?? null, reference_mode: referenceMode, configuration: plan.configuration, style_rendering: plan.style_rendering,
    round_plan: roundPlan, prompt: [...new Set(lines)].join('\n\n'),
    evidence: { image_generated: false, visual_quality_verified: false } });
}
