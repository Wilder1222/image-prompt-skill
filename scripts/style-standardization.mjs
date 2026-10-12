import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt,objectHash,promptHash} from './production-prompt.mjs';
import {loadVisualPreferenceCatalog,validateVisualPreferenceCatalog} from './visual-preferences.mjs';
import {assertReferenceFacePresetBindings} from './reference-face-presets.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inputKeys=['id','asset_id','original_reference_id','mode','task_type','standardization_goals','protected_observations','portrait_comparison_request','change_variant','scope_format'];
export const styleStandardizationContract='style_standardization_projection_v1';
const faceTonalOnly='仅在原画布内对已经可见的面部暗部做极轻微的亮度补偿；保持原光向、色温、对比和空气感。其余主体、衣饰、材料图案、环境、颗粒笔触、软边、画幅取景、神态及动作保持原样；不锐化、不去颗粒、不添加细纹，不重画人物或场景。';
// Compatibility for pre-contract pilot snapshots only. New targets declare the
// typed face_tonal_only variant and receive task-neutral prose above.
const legacyFaceTonalOnly='只在原图画布内，对已经可见的面部暗部做极轻微的亮度补偿，保持原对比、低饱和关系、雾化空气感和色温。衣料、金纹、发饰、叶花、石水与背景原样保留；原颗粒、粗细笔触和软边不去除、不锐化，不追加细金线、刺绣或微观纹理，不重画人物或场景。画幅横竖类别、长宽关系、取景和所有原动作保持。';
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const unique=values=>[...new Set(values)];
const taskTypes=new Set(['macro_portrait','scene_character','character_portrait','full_body_character','scene','product','other']);
const defaultGoals={
  macro_portrait:['readability','tonal_hierarchy','edge_hierarchy','material_separation'],
  scene_character:['readability','tonal_hierarchy','edge_hierarchy','material_separation'],
  character_portrait:['readability','task_framing','tonal_hierarchy','edge_hierarchy'],
  full_body_character:['readability','task_framing','edge_hierarchy','material_separation'],
  scene:['readability','task_framing','tonal_hierarchy','edge_hierarchy'],
  product:['readability','task_framing','edge_hierarchy','material_separation'],
  other:['readability','edge_hierarchy']
};
const goalDefinitions={
  readability:{channel:'output',text:'提高既有主焦点的可读性，只修正影响阅读的瑕疵；不重捏五官，不抹除真实纹理、妆饰或原有笔触。'},
  task_framing:{channel:'composition',text:'仅在当前任务所需范围内微调画框和边界余量，保持原取景尺度、主要视点、主体关系及动势；已有握持和接触关系保持连贯，不补画未知的完整身体、发冠或道具端部。'},
  tonal_hierarchy:{channel:'lighting',text:'整理原光照中的明暗层次，使重要面容、衣料与环境各有阅读空间；保持原光源方向、色温关系、亮边、阴影体积及空气感，不改成统一平光。'},
  edge_hierarchy:{channel:'style',text:'统一清晰度的层级：原主焦点保持适度清楚，次要衣景保留该媒介的软边、笔触和景深；不把所有轮廓均匀锐化。'},
  material_separation:{channel:'material',text:'在原材料与图案范围内区分皮肤、发丝、织物、金属和环境的反射层次，保留原细节尺度与完成方式，不新增材料对象或饰件。'}
};
const compactChanges={
  readability:'只修正既有焦点中影响阅读的瑕疵，保持五官、妆饰与原纹理。',
  task_framing:'只微调当前画框余量，保持主要视点、尺度与接触，不补画未知区域。',
  tonal_hierarchy:'只整理现有明暗层次，保持原光向、色温、阴影体积与空气感。',
  edge_hierarchy:'只整理原主次清晰度，保持媒介笔触与次要区域软边。',
  material_separation:'只整理原材料的反射层次，保持材料种类、纹样和细节尺度。'
};
const dimensionRules={
  face:['identity','面容','本人实际可辨的脸型、眉形、眼形与眼距、鼻唇、人中、下巴、自然不对称、基础肤色、年龄观感及原可见眼色；不借校准或可读性处理磨皮、瘦脸、改五官或统一成模板脸'],
  expression:['expression','神态','原视线、眼睑、眉间和唇口表达的基本神态'],
  makeup:['makeup','妆肤','原可见眉妆、眼线、眼影、睫毛、腮红、唇妆及实际已有额饰和痣各自的形状、位置与范围，保持颜色、浓度与妆量、边缘过渡、光泽和肤感；不以统一妆容覆盖本人原妆，不新增或移动标记'],
  hair:['hair','发型','原发色、可见主发束、盘束、饰件及发丝流向'],
  costume:['costume','衣饰','原可见衣片、领缘、饰件、纹样及衣料连接'],
  material:['material','材质','原材料的厚薄、透叠、反射差异和可见纹理'],
  pose:['action','动作','原站坐状态、头肩关系、支撑、手势、握持、接触及衣发动态'],
  lighting:['lighting','光线','原主光方向、冷暖关系、亮边、阴影体积与空气感'],
  palette:['style','配色','原主辅色块、冷暖和明暗关系，保持本人基础肤色、发色、眼部观感及衣色'],
  composition:['composition','构图','原取景尺度、主体前后高低、大小、遮挡关系及视觉动势'],
  scene:['background','环境','原可见环境、植被、水面、建筑或抽象背景的层次与氛围'],
  creature:['background','生物','原可见生物数量、头部和轮廓差异、尺度及与人物的空间关系'],
  medium:['style','媒介','原面容、衣饰与环境各自的媒介完成方式、笔触及颗粒关系']
};
function keys(value,allowed,label){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new Error(`invalid or unsupported ${label} fields`);}
function optionsOf(options,allowed){keys(options,allowed,'style standardization options');const catalog=options.catalog??loadVisualPreferenceCatalog();validateVisualPreferenceCatalog(catalog);return catalog;}
function sourceFile(asset){
  if(asset.source.availability!=='local_verified'||!digest(asset.source.sha256)||!nonempty(asset.source.local_path)||!['actual_pixels','historical_pixels'].includes(asset.inspection.status))
    throw new Error('style standardization requires a currently local hash-bound original with pixel inspection; unavailable and record-only sources stay records');
  const source=path.resolve(root,asset.source.local_path);
  if(promptHash(fs.readFileSync(source))!==asset.source.sha256)throw new Error('catalog original source SHA changed; candidates cannot replace the original');
  return source;
}
function deriveTask(asset){
  if(asset.subjects.includes('character')){
    if(asset.framing==='close_up')return 'macro_portrait';
    if(asset.framing==='full_body')return 'full_body_character';
    if(asset.framing==='scene_integrated'||asset.subjects.includes('scene')||asset.subjects.includes('creature'))return 'scene_character';
    if(['head_shoulders','half_body'].includes(asset.framing))return 'character_portrait';
    return null;
  }
  if(asset.subjects.includes('product'))return 'product';
  if(asset.subjects.includes('scene')||asset.subjects.includes('creature'))return 'scene';
  return 'other';
}
function checkSingleSubject(asset){
  if(asset.framing==='multi_look_board'||asset.subjects.some(subject=>/multi[_ -]?(?:person|character)|crowd|多人|群像/i.test(subject)))
    throw new Error('standardization supports one person with creatures/environment, not multiple person identities or boards');
}
function framingText(task){
  return task==='macro_portrait'?'继续采用原妆肤极近特写和原头部角度，保留有意的紧裁切，不强补完整头顶、发冠或身体。':
    task==='scene_character'?'保留人物与当前环境或生物组合，沿原画框整理阅读层次；不退回灰底棚拍，也不删减既有场景主体。':
    task==='full_body_character'?'保持原全身或接近全身的展示用途、体态与衣摆尺度；边界调整不拉长肢段，不为了留白缩小头部。':
    task==='character_portrait'?'保持原肖像的近景或半身用途及既有头肩视点，微调仅服务当前可见内容，不默认改为证件式正面。':
    '保持当前场景或对象的展示用途、主次尺度与原画框关系，调整以既有主体的可读性为限。';
}
function row(id,channel,text,kind,extra={}){return {id,channel,text,kind,critical:kind!=='unavailable',initial_verdict:kind==='unavailable'?'not_assessable':'pending',...extra};}

// This builds a declared editing contract, not pixel analysis or an accepted image.
export function buildStyleStandardizationPlan(input,options={}){
  const catalog=optionsOf(options,['catalog']);keys(input,inputKeys,'style standardization input');
  if(!nonempty(input.id)||!/^[A-Za-z0-9_-]+$/.test(input.id)||!nonempty(input.asset_id))throw new Error('style standardization needs a stable id and original asset_id');
  const asset=catalog.assets.find(asset=>asset.id===input.asset_id||asset.aliases.includes(input.asset_id));
  if(!asset)throw new Error('unknown style standardization asset');checkSingleSubject(asset);sourceFile(asset);
  const mode=input.mode??'task_style_preserve';
  if(!['task_style_preserve','portrait_comparison'].includes(mode))throw new Error('unsupported style standardization mode');
  if(input.scope_format!==undefined&&!['compact','detailed'].includes(input.scope_format))throw new Error('scope_format must be compact or detailed');
  if(mode==='portrait_comparison'&&!nonempty(input.portrait_comparison_request))throw new Error('portrait_comparison requires the explicit user request in a separately authored target');
  if(mode!=='portrait_comparison'&&input.portrait_comparison_request!==undefined)throw new Error('portrait comparison authorization belongs only to portrait_comparison');
  const inferred=deriveTask(asset),task=input.task_type??inferred;
  if(!taskTypes.has(task)||(asset.subjects.includes('character')!==['macro_portrait','scene_character','character_portrait','full_body_character'].includes(task)))throw new Error('task_type conflicts with source subject scope; ambiguous framing needs an explicit compatible task_type');
  if(inferred!==null&&task!==inferred)throw new Error('task_type override cannot replace known original framing or scene purpose; author an explicitly changed task separately');
  if(mode==='portrait_comparison'&&!asset.subjects.includes('character'))throw new Error('portrait comparison requires a single character source');
  const original_reference_id=input.original_reference_id??'ORIGINAL';
  if(!nonempty(original_reference_id))throw new Error('original_reference_id must be nonempty');
  const goals=input.standardization_goals??defaultGoals[task];
  if(!Array.isArray(goals)||!goals.length||new Set(goals).size!==goals.length||goals.some(goal=>!Object.hasOwn(goalDefinitions,goal)))throw new Error('standardization goals must select supported quality adjustments, not arbitrary restyling prose');
  if(input.change_variant!==undefined&&(input.change_variant!=='face_tonal_only'||mode!=='task_style_preserve'||goals.length!==1||goals[0]!=='tonal_hierarchy'))
    throw new Error('face_tonal_only is a typed narrowing of an authorized original-style tonal goal');
  const authored={...structuredClone(input),asset_id:asset.id,original_reference_id,mode,task_type:task,standardization_goals:[...goals],protected_observations:structuredClone(input.protected_observations??[])};
  if(!Array.isArray(authored.protected_observations))throw new Error('protected_observations must be explicit dimension/index selections');
  const prefix=`SS:${input.id}`,checks=[],selected=new Set(),observations=asset.observations.map((observation,index)=>({observation_index:index,...structuredClone(observation)}));
  checks.push(row(`${prefix}:source`,asset.subjects.includes('character')?'identity':'task',
    '输入原图是本次编辑的唯一图像基准；保持原图已有主体及其可见关系，不混入其他参考人物，不新增原图没有的头饰、妆饰、痣、生物或持物。未清楚展示的结构保持未知。','binding'));
  checks.push(row(`${prefix}:task`,'task',mode==='portrait_comparison'?
    '按本轮明确授权的独立肖像对照任务，统一正面视点、中性背景与中性柔光；保护原图本人、原媒介、基础肤色、妆色、发型衣饰与实际可见结构。该对照不授权换妆、磨皮、瘦脸或更换眼色，不套用同脸或照片模板。':framingText(task),'preserve'));
  for(const [dimension,[channel,label,description]]of Object.entries(dimensionRules)){
    const declared=observations.filter(observation=>observation.dimension===dimension),usable=declared.filter(observation=>observation.visibility!=='unknown');
    if(!usable.length)continue;
    let text=`保持原图${label}中的${description}，以实际可见范围为准`;
    if(usable.every(observation=>observation.visibility==='partial'))text=`仅保持原图实际可见部分的${label}：${description}；画外或遮挡部分不声明精确重建`;
    if(mode==='portrait_comparison'&&['pose','lighting','composition','scene'].includes(dimension)){
      text=dimension==='pose'?'仅按本轮明确对照目标调整整体头部朝向；保持基本神态、体积及当前可见的手势、握持和接触关系，不独立重画两眼凑水平。':
        dimension==='lighting'?'本轮对照按明确目标使用中性柔光；保持基础肤色、妆色与鼻颊体积，不把光照变化解释为换人或抹平骨相。':
        dimension==='composition'?'本轮对照按明确目标整理肖像画框；余量依当前可见发饰与任务决定，不使用固定头部占比、统一肩顶裁切或补写未知结构。':
        '本轮对照按明确目标使用中性背景；任何生物或重要环境主体的移除、隐藏须在用户请求中另有明确授权，不能仅为灰底删减已有主体。';
    }
    const question=dimension==='face'?'仅在原图实际可辨范围内，脸型、眉形、眼形眼距、鼻唇人中下巴、自然不对称、基础肤色年龄与可见眼色是否保持本人，且没有磨皮瘦脸、改五官或认证未知结构？':
      dimension==='makeup'?'仅在原图实际可见范围内，眉妆、眼线眼影睫毛、腮红唇妆、已有额饰与痣的形状位置范围、颜色浓度妆量、边缘和光泽肤感是否保持一致，且没有换成统一妆容或新增移动标记？':undefined;
    checks.push(row(`${prefix}:preserve:${dimension}`,channel,text+'。','preserve',{dimension,review_extent:usable.every(observation=>observation.visibility==='partial')?'visible_portion_only':'visible',raw_observations_are_requirements:false,...(question?{question}:{})}));
  }
  for(const selection of authored.protected_observations){
    keys(selection,['dimension','observation_index'],'protected observation selection');
    const observation=observations[selection.observation_index];
    if(!Number.isSafeInteger(selection.observation_index)||!observation||observation.dimension!==selection.dimension||selected.has(selection.observation_index))throw new Error('protected observation must select a unique exact dimension/index from the original');
    selected.add(selection.observation_index);
    if(observation.visibility==='unknown')throw new Error('unknown source observations cannot become must-preserve facts');
    if(mode==='portrait_comparison'&&['lighting','pose','composition','scene'].includes(selection.dimension))throw new Error('portrait comparison cannot also strongly lock a dimension that its explicit changed target replaces');
    const [channel,label]=dimensionRules[selection.dimension];
    const text=`${observation.visibility==='partial'?'仅在原图实际可见部分，':'在原图实际可见范围内，'}保护已选${label}细节：${observation.text}。不补写遮挡或画外部分。`;
    checks.push(row(`${prefix}:detail:${selection.observation_index}`,channel,text,'preserve',{dimension:selection.dimension,observation_index:selection.observation_index,review_extent:observation.visibility==='partial'?'visible_portion_only':'visible'}));
  }
  for(const goal of goals){
    const definition=goalDefinitions[goal];
    const text=mode==='portrait_comparison'&&goal==='task_framing'?'仅按明确的肖像对照目标整理画框，不添加未知完整发冠或画外身体；源图不可判断的部位继续单列未知。':
      mode==='portrait_comparison'&&goal==='tonal_hierarchy'?'在本轮明确中性光对照目标内保持自然明暗体积与面部可读性，保留基础肤色和妆色，不以均匀亮度替代体积。':definition.text;
    checks.push(row(`${prefix}:goal:${goal}`,definition.channel,text,'change',{goal}));
  }
  const unavailable=observations.filter(observation=>observation.visibility==='unknown');
  for(const observation of unavailable)checks.push(row(`${prefix}:unknown:${observation.observation_index}`,dimensionRules[observation.dimension][0],
    `原图${dimensionRules[observation.dimension][1]}此项不可判断，继续记录为未知：${observation.text}；新生成细节不能倒推为原图事实。`,'unavailable',{dimension:observation.dimension,observation_index:observation.observation_index,review_extent:'unavailable'}));
  const body={schema_version:1,input:authored,mode,task_type:task,inferred_task_type:inferred,original_reference_id,asset_id:asset.id,
    source:structuredClone(asset.source),source_inspection:structuredClone(asset.inspection),source_subjects:[...asset.subjects],source_framing:asset.framing,source_medium:asset.medium,identity_preset_id:asset.identity_preset_id,
    catalog_sha256:objectHash(catalog),observations,checks,unavailable_observations:unavailable,
    source_subject_kind:asset.subjects.includes('character')?'character':task==='scene'?'scene':task==='product'?'product':'other',
    scope_contract:styleStandardizationContract,
    changes:input.change_variant==='face_tonal_only'?[faceTonalOnly]:[...(mode==='portrait_comparison'?[checks.find(check=>check.id===`${prefix}:task`).text]:[]),...checks.filter(check=>check.kind==='change').map(check=>check.text)],
    preserve:[checks.find(check=>check.kind==='binding').text,
      ...(mode==='task_style_preserve'?[checks.find(check=>check.id===`${prefix}:task`).text]:[]),
      `在原图实际可见范围内保持${checks.filter(check=>check.kind==='preserve'&&check.dimension&&check.observation_index===undefined).map(check=>`${dimensionRules[check.dimension][1]}${check.review_extent==='visible_portion_only'?'的可见部分':''}`).join('、')}；不把未见结构补画成已确认源事实。`,
      ...checks.filter(check=>check.kind==='preserve'&&check.observation_index===undefined&&['face','makeup'].includes(check.dimension)).map(check=>check.text),
      ...checks.filter(check=>check.kind==='preserve'&&check.observation_index!==undefined).map(check=>check.text)],
    authorization:{portrait_comparison_request:input.portrait_comparison_request??null,user_request_authenticated:false},
    evidence:{image_generated:false,pixel_analysis_performed:false,visual_quality_verified:false,user_accepted:false,control_assets_used:[]}};
  if(input.scope_format==='compact'){
    body.changes=input.change_variant==='face_tonal_only'?
      ['仅补偿原画布内已见面部暗部的亮度，保持原光向、色温与对比；其余区域不重画。']:
      [...(mode==='portrait_comparison'?['仅按明确肖像对照目标统一正面视点、背景与柔光；不换妆或重塑面容。']:[]),
        ...goals.map(goal=>mode==='portrait_comparison'&&goal==='task_framing'?'只整理肖像对照画框，不补画未知冠顶或身体。':
          mode==='portrait_comparison'&&goal==='tonal_hierarchy'?'只整理中性柔光下的明暗体积，保持基础肤色与原妆色。':compactChanges[goal])];
    const preservedDimensions=unique(checks.filter(check=>check.kind==='preserve'&&check.dimension&&
      !(mode==='portrait_comparison'&&['pose','lighting','composition','scene'].includes(check.dimension))).map(check=>dimensionRules[check.dimension][1]));
    body.preserve=[
      '只以输入原图为本次来源；保留原主体及实际可见结构，未见部分继续未知。',
      ...(mode==='task_style_preserve'?['保留原任务、取景和主体组合，全部逐项保护以对应正文为准。']:[]),
      `保留原图实际可见的${preservedDimensions.length?preservedDimensions.join('、'):'主体内容'}及正文选定的具体细节。`,
      '本人五官、基础肤色与原妆各自的形状、位置、颜色及妆量保持；不新增标记，不以清晰度重绘或锐化原笔触。'
    ];
    if(!asset.subjects.includes('character'))body.preserve.pop();
  }
  return {...body,plan_sha256:objectHash(body)};
}
function checkPlanHash(plan){
  if(!plain(plan)||plan.schema_version!==1||!digest(plan.plan_sha256))throw new Error('unsupported style standardization plan');
  const {plan_sha256,...body}=plan;if(objectHash(body)!==plan_sha256)throw new Error('style standardization plan hash changed; rebuild the target');
}
function rebuild(plan,catalog){
  checkPlanHash(plan);const rebuilt=buildStyleStandardizationPlan(plan.input,{catalog});
  if(rebuilt.plan_sha256!==plan.plan_sha256)throw new Error('style standardization catalog or derived plan changed; rebuild from authored input');return rebuilt;
}
function acceptanceQuestion(check){return check.question??(check.kind==='unavailable'?
  '原图此项仍不可判断，是否单列未知而未将生成细节升级为已确认来源事实？':'仅就冻结的原图可见范围，所选保护或标准化目标是否实现，且没有越权改变原任务风格与内容？');}
function sameStringSet(a,b){return Array.isArray(a)&&a.length===b.length&&a.every(nonempty)&&new Set(a).size===a.length&&objectHash([...a].sort())===objectHash([...b].sort());}

// Freeze/verify pass their byte receipts here, so a file changed after apply cannot
// be silently frozen as another original. This helper does not read pixels.
export function assertStyleStandardizationBindings(references,requirements,projection={}){
  keys(projection,['acceptance','edit_scope','sections','prompt','required'],'style standardization projection');
  const plans=(requirements??[]).filter(requirement=>Object.hasOwn(requirement,'style_standardization_plan'));
  if(!plans.length){
    if(projection.required===true||(requirements??[]).some(requirement=>String(requirement.id).startsWith('SS:')))
      throw new Error('required style standardization contract cannot be removed from its projection');
    return null;
  }
  if(plans.length!==1)throw new Error('only one style standardization plan can be frozen');
  const plan=plans[0].style_standardization_plan;checkPlanHash(plan);
  const actual=references.filter(reference=>reference.generation_input),original=actual[0];
  if(actual.length!==1||!original||original.id!==plan.original_reference_id||original.inspected!==true||original.content_sha256!==plan.source.sha256)
    throw new Error('style standardization requires the exact original SHA and unique actual original input');
  const identities=references.filter(reference=>reference.authority?.includes('identity'));
  if(plan.source_subject_kind==='character'&&(identities.length!==1||identities[0]!==original))throw new Error('original must remain the sole character identity source');
  if(plan.identity_preset_id!==null&&original.identity_target_id!==plan.identity_preset_id)throw new Error('existing original RP identity binding must be retained');
  if(plan.identity_preset_id===null&&original.identity_target_id?.startsWith('RP-'))throw new Error('visual preference source cannot acquire an unrelated RP identity preset');
  if(plan.scope_contract!==undefined&&plan.scope_contract!==styleStandardizationContract)throw new Error('unsupported style standardization scope contract');
  if(projection.acceptance!==undefined){
    if(!Array.isArray(projection.acceptance))throw new Error('style projection needs frozen acceptance');
    for(const check of plan.checks){
      const projected=requirements.filter(requirement=>requirement.id===check.id),criterion=projection.acceptance.filter(criterion=>criterion.id===`${check.id}:check`);
      if(projected.length!==1||projected[0].text!==check.text||projected[0].channel!==check.channel||projected[0].priority!==(check.critical?'must':'prefer'))
        throw new Error('style standardization must retain every exact required protection and quality projection');
      if(criterion.length!==1||criterion[0].basis!==check.id||criterion[0].critical!==check.critical||criterion[0].question!==acceptanceQuestion(check))
        throw new Error('style standardization must retain every exact critical acceptance projection');
      if(projection.sections!==undefined&&!projection.sections.some(section=>section.channel===check.channel&&section.items?.some(item=>item.text===check.text&&item.intent==='constraint'&&item.basis?.includes(check.id))))
        throw new Error('style standardization text projection must remain in its authored section');
      if(projection.prompt!==undefined&&!projection.prompt.split('【本次编辑范围】')[0].includes(check.text))
        throw new Error('style standardization text projection must remain in the frozen prompt');
    }
    const scope=projection.edit_scope;
    if(!plain(scope)||scope.baseline_reference_id!==plan.original_reference_id||!Array.isArray(scope.preserve)||!plan.preserve.every(text=>scope.preserve.includes(text)))
      throw new Error('style standardization scope must retain the original baseline and every protected item');
    const legacyNarrowing=plan.scope_contract===undefined&&plan.mode==='task_style_preserve'&&plan.input.standardization_goals.length===1&&plan.input.standardization_goals[0]==='tonal_hierarchy'&&sameStringSet(scope.changes,[legacyFaceTonalOnly]);
    if(!sameStringSet(scope.changes,plan.changes)&&!legacyNarrowing)
      throw new Error('style standardization change scope cannot expand or arbitrarily rewrite the frozen authorization; declare a typed narrowing and rebuild');
  }
  return plan;
}

export function applyStyleStandardizationPlan(brief,inputOrPlan,options={}){
  const catalog=optionsOf(options,['catalog','base_dir']);
  if(options.base_dir!==undefined&&!nonempty(options.base_dir))throw new Error('base_dir must be a directory path');
  const alreadyApplied=brief?.metadata?.style_standardization!==undefined||(brief?.requirements??[]).some(requirement=>Object.hasOwn(requirement,'style_standardization_plan')||String(requirement.id).startsWith('SS:'))||
    (brief?.sections??[]).some(section=>section.items?.some(item=>item.basis?.some(id=>String(id).startsWith('SS:'))));
  if(alreadyApplied)throw new Error('brief already contains style standardization; rebuild from the authored brief, do not stack old goals');
  compileProductionPrompt(brief);
  const plan=Object.hasOwn(inputOrPlan??{},'plan_sha256')?rebuild(inputOrPlan,catalog):buildStyleStandardizationPlan(inputOrPlan,{catalog});
  if(brief.subject_kind!==plan.source_subject_kind)throw new Error('style standardization subject_kind must match the original task; person with creature remains character');
  const references=brief.references.map(reference=>({...reference,content_sha256:promptHash(fs.readFileSync(path.resolve(options.base_dir??process.cwd(),reference.source)))}));
  assertStyleStandardizationBindings(references,[{style_standardization_plan:plan}]);assertReferenceFacePresetBindings(references);
  if(brief.edit_scope&&brief.edit_scope.baseline_reference_id!==plan.original_reference_id)throw new Error('standardization edit baseline must be the single original, not a candidate');
  const next=structuredClone(brief);
  for(const [index,check]of plan.checks.entries()){
    if(next.requirements.some(requirement=>requirement.id===check.id)||next.acceptance.some(criterion=>criterion.id===`${check.id}:check`))throw new Error('style standardization projection id conflicts with authored targets');
    next.requirements.push({id:check.id,channel:check.channel,priority:check.critical?'must':'prefer',text:check.text,...(index===0?{style_standardization_plan:structuredClone(plan)}:{})});
    next.acceptance.push({id:`${check.id}:check`,basis:check.id,critical:check.critical,question:acceptanceQuestion(check)});
  }
  const labels=new Set(next.sections.map(section=>section.label));
  for(const [channel,label]of [['identity','原肖像保护'],['task','原任务保护'],['expression','原神态保护'],['action','原动作保护'],['makeup','原妆肤保护'],['hair','原发型保护'],['costume','原衣饰保护'],['material','材质分层调整'],['composition','当前取景调整'],['background','原环境与生物保护'],['lighting','原受光与层次调整'],['style','原媒介与边缘层次'],['output','画面可读性调整']]){
    const checks=plan.checks.filter(check=>check.channel===channel);if(!checks.length)continue;
    const sectionLabel=label;if(labels.has(sectionLabel))throw new Error('style standardization section label conflict');
    next.sections.push({label:sectionLabel,channel,items:checks.map(check=>({text:check.text,basis:[check.id],intent:'constraint'}))});
  }
  next.edit_scope={baseline_reference_id:plan.original_reference_id,changes:[...plan.changes],preserve:unique([...(brief.edit_scope?.preserve??[]),...plan.preserve])};
  next.metadata={...(next.metadata??{}),style_standardization:{plan_sha256:plan.plan_sha256,mode:plan.mode,asset_id:plan.asset_id,source_sha256:plan.source.sha256,
    original_reference_id:plan.original_reference_id,task_type:plan.task_type,visual_quality_verified:false,user_accepted:false}};
  compileProductionPrompt(next);return next;
}

export function validateStyleStandardizationChecks(plan,review){
  checkPlanHash(plan);keys(review,['plan_sha256','checks'],'style standardization review');
  if(review.plan_sha256!==plan.plan_sha256||!Array.isArray(review.checks)||review.checks.length!==plan.checks.length)throw new Error('review must bind the exact plan and cover every style check');
  const seen=new Set();
  for(const check of review.checks){
    keys(check,['id','verdict','evidence'],'style review check');const target=plan.checks.find(target=>target.id===check.id);
    if(!target||seen.has(check.id)||!['pass','fail','uncertain','not_assessable'].includes(check.verdict)||!nonempty(check.evidence))throw new Error('style review needs every exact check once with verdict and evidence');seen.add(check.id);
    if(target.kind==='unavailable'&&!['uncertain','not_assessable'].includes(check.verdict))throw new Error('unknown original observations cannot acquire a pass from a generated candidate');
  }
  return {status:'review_declarations_checked',plan_sha256:plan.plan_sha256,checks:structuredClone(review.checks),visual_quality_verified:false,user_accepted:false};
}
