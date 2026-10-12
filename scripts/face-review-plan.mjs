import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {faceControlCatalog} from './face-design.mjs';
import {compileProductionPrompt,objectHash,promptHash} from './production-prompt.mjs';
import {assertReferenceFacePresetBindings} from './reference-face-presets.mjs';

const inputKeys=['id','request','original_reference_id','baseline_reference_id','available_views','axes'];
const views=new Set(['front','three_quarter','profile']);
const stableLayers=new Set(['structure','soft_tissue','surface_identity']);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value);
const unique=values=>[...new Set(values)];

function keys(value,allowed,label){
  if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new Error(`invalid or unsupported ${label} fields`);
}
function inputOf(record){return Object.fromEntries(inputKeys.filter(key=>Object.hasOwn(record,key)).map(key=>[key,structuredClone(record[key])]));}
function selectorInfo(selector,catalog){
  if(typeof selector!=='string')throw new Error('review selector must be a dimension name');
  const [axis,side,...extra]=selector.split(':'),dimension=catalog.dimensions[axis];
  if(!Object.hasOwn(catalog.dimensions,axis)||extra.length||(side!==undefined&&(!['left','right'].includes(side)||dimension.laterality!=='bilateral')))
    throw new Error(`invalid face review selector ${selector}`);
  return {axis,side,dimension,label:side?`人物自身${side==='left'?'左':'右'}侧的${dimension.label}`:dimension.label};
}
function visualText(text,catalog){
  if(!nonempty(text)||/[【】]|\bTODO\b|待填写/.test(text))throw new Error('review goal needs finished visual prose');
  const axes=Object.keys(catalog.dimensions).map(axis=>axis.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  if(new RegExp(`\\b(?:${axes})(?:\\s*[.:]\\s*(?:left|right))?["']?\\s*(?:[=:：＝]|设置\\s*为|设\\s*为|为)\\s*["']?\\s*[-+]?(?:\\d|\\.\\d)`,'i').test(text)||/\b\w*slider\w*\s*[=:：＝]|滑杆|滑块/i.test(text))
    throw new Error('review goals cannot contain numeric axis or slider controls');
  return text.trim();
}

export function buildFaceReviewPlan(input){
  keys(input,inputKeys,'face review plan');
  if(!nonempty(input.id)||!/^[A-Za-z0-9_-]+$/.test(input.id)||!nonempty(input.request))throw new Error('review plan needs a stable id and request');
  if(!nonempty(input.original_reference_id)||!nonempty(input.baseline_reference_id)||input.original_reference_id===input.baseline_reference_id)
    throw new Error('review plan needs distinct original and candidate baseline references');
  keys(input.available_views,[input.original_reference_id,input.baseline_reference_id],'available_views');
  for(const id of [input.original_reference_id,input.baseline_reference_id]){
    const declared=input.available_views[id];
    if(!Array.isArray(declared)||new Set(declared).size!==declared.length||declared.some(view=>!views.has(view)))throw new Error(`declare actual available views for ${id}; [] means unavailable`);
  }
  if(!Array.isArray(input.axes)||!input.axes.length)throw new Error('review plan needs selected axes');
  const catalog=faceControlCatalog(),seen=new Set(),rows=[];
  for(const axisRow of input.axes){
    keys(axisRow,['selector','role','goal','observation'],'review axis');
    const {axis,side,dimension,label}=selectorInfo(axisRow.selector,catalog),stable=stableLayers.has(dimension.layer);
    if(seen.has(axisRow.selector)||!['change','preserve','inspect'].includes(axisRow.role))throw new Error('duplicate selector or unsupported review role');
    seen.add(axisRow.selector);
    keys(axisRow.observation,['reference_id','fact_id','text','visibility','view'],'review observation');
    const observation=axisRow.observation;
    if(![input.original_reference_id,input.baseline_reference_id].includes(observation.reference_id)||!nonempty(observation.fact_id)||!nonempty(observation.text)||
      !['visible','partial','unknown','not_visible'].includes(observation.visibility)||(!views.has(observation.view)&&observation.view!=='unknown'))throw new Error('review observation needs an actual reference, fact, text, visibility and view');
    const available=input.available_views[observation.reference_id].includes(observation.view)&&dimension.assessment_views.includes(observation.view);
    const extent=!available||['unknown','not_visible'].includes(observation.visibility)?'unavailable':observation.visibility==='partial'?'visible_portion_only':'visible';
    if(axisRow.role==='change'&&stable)throw new Error('standardization cannot change stable identity axes; geometry redesign uses reviseFaceDesign');
    if(axisRow.role!=='inspect'&&extent==='unavailable')throw new Error('unknown or unavailable-view axes can only be inspected, not changed or strictly preserved');
    if(stable&&observation.reference_id!==input.original_reference_id)throw new Error('all stable review observations must use the original, never the candidate');
    if(axisRow.role==='change')visualText(axisRow.goal,catalog);
    else if(axisRow.goal!==undefined)throw new Error('only change rows may declare a goal');
    if(axisRow.role==='preserve')visualText(observation.text,catalog);
    rows.push({...structuredClone(axisRow),axis,side:side??null,label,layer:dimension.layer,channel:dimension.channel,group:dimension.group,
      assessment_views:[...dimension.assessment_views],review_extent:extent,critical:axisRow.role!=='inspect',initial_verdict:extent==='unavailable'?'not_assessable':'unreviewed'});
  }
  for(const axis of unique(rows.map(row=>row.axis)))if(seen.has(axis)&&rows.some(row=>row.axis===axis&&row.side))throw new Error('a review plan cannot mix flat and sided selectors for the same axis');
  const selected=new Set(rows.map(row=>row.axis));
  const relationships=catalog.relationship_checks.filter(check=>check.axes.some(axis=>selected.has(axis))).map(check=>({...structuredClone(check),
    selected_axes:check.axes.filter(axis=>selected.has(axis)),adjacent_axes:check.axes.filter(axis=>!selected.has(axis)),automatic_change_authority:false,critical:false,initial_verdict:'unreviewed'}));
  const body={...inputOf(input),schema_version:1,catalog_version:catalog.version,side_convention:'character_anatomical_left_right',
    selected_axes:rows.map(row=>row.selector),changed_axes:rows.filter(row=>row.role==='change').map(row=>row.selector),changed_stable_axes:[],
    protected_stable_axes:rows.filter(row=>row.role==='preserve'&&stableLayers.has(row.layer)).map(row=>row.selector),
    unselected_stable_axes:Object.entries(catalog.dimensions).filter(([axis,dimension])=>stableLayers.has(dimension.layer)&&!selected.has(axis)).map(([axis])=>axis),
    unavailable_axes:rows.filter(row=>row.review_extent==='unavailable').map(row=>row.selector),axis_checks:rows,relationship_checks:relationships,
    evidence:{image_generated:false,visual_quality_verified:false,user_accepted:false,pixel_analysis_performed:false},
    note:'This is a declared review plan. Unselected axes are navigation and scope boundaries, not confirmed original geometry. Relationships require review and do not authorize edits.'};
  return {...body,plan_sha256:objectHash(body)};
}

function rebuild(inputOrPlan){
  const built=buildFaceReviewPlan(inputOf(inputOrPlan));
  if(inputOrPlan.plan_sha256!==undefined&&inputOrPlan.plan_sha256!==built.plan_sha256)throw new Error('face review plan hash changed; rebuild and freeze the revised target');
  return built;
}

export function applyFaceReviewPlan(brief,inputOrPlan,options={}){
  keys(options,['base_dir'],'face review options');
  if(options.base_dir!==undefined&&!nonempty(options.base_dir))throw new Error('base_dir must be a directory path');
  if(brief?.subject_kind!=='character')throw new Error('face review needs an authored character brief');
  const isPlanId=id=>typeof id==='string'&&id.startsWith('FRP:');
  if((brief.requirements??[]).some(row=>isPlanId(row.id)||Object.hasOwn(row,'face_review_plan'))||
      (brief.acceptance??[]).some(row=>isPlanId(row.id)||isPlanId(row.basis))||
      (brief.sections??[]).some(section=>section.items?.some(item=>item.basis?.some(isPlanId))))
    throw new Error('brief already contains a face review plan; rebuild from the authored brief rather than stacking or deleting previous FRP targets');
  compileProductionPrompt(brief);
  const plan=rebuild(inputOrPlan),next=structuredClone(brief),original=next.references.find(ref=>ref.id===plan.original_reference_id),baseline=next.references.find(ref=>ref.id===plan.baseline_reference_id);
  const identities=next.references.filter(ref=>ref.authority.includes('identity')),inputs=next.references.filter(ref=>ref.generation_input);
  if(!original||!baseline||identities.length!==1||identities[0]!==original||original.inspected!==true||original.generation_input!==true)
    throw new Error('original must be the sole inspected identity authority and an actual generation input');
  if(baseline.inspected!==true||baseline.generation_input!==true||baseline.authority.length||baseline.identity_role!==undefined||baseline.identity_target_id!==undefined||baseline.identity_group!==undefined)
    throw new Error('candidate baseline must be inspected, an actual input, authority:[] and have no identity declarations');
  if(inputs.length!==2||!inputs.includes(original)||!inputs.includes(baseline))throw new Error('face revision requires exactly two actual inputs: original and candidate baseline');
  const receipts=next.references.map(ref=>({...ref,source:path.resolve(options.base_dir??process.cwd(),ref.source),content_sha256:promptHash(fs.readFileSync(path.resolve(options.base_dir??process.cwd(),ref.source)))}));
  if(receipts.find(ref=>ref.id===original.id).source===receipts.find(ref=>ref.id===baseline.id).source)throw new Error('candidate baseline cannot be the original file itself');
  assertReferenceFacePresetBindings(receipts);
  const sideFacts=new Map();
  for(const row of plan.axis_checks){
    const ref=next.references.find(ref=>ref.id===row.observation.reference_id),fact=ref.facts.find(f=>f.id===row.observation.fact_id);
    if(!fact||fact.text!==row.observation.text||fact.visibility!==row.observation.visibility)throw new Error(`review observation must match exact fact id, text and visibility: ${row.selector}`);
    if(fact.channel!==row.channel)throw new Error(`review fact channel must match the selected axis channel: ${row.selector}`);
    if(fact.view!==undefined&&fact.view!==row.observation.view)throw new Error('review observation view conflicts with its source fact');
    if(fact.selector!==undefined&&fact.selector!==row.selector)throw new Error('review selector conflicts with its source fact');
    if(!row.side&&['left','right'].includes(fact.side))throw new Error('a one-sided fact cannot become a flat review selector');
    if(row.side){
      if(fact.side!==undefined&&fact.side!==row.side)throw new Error('review side conflicts with its source fact');
      const key=JSON.stringify([ref.id,fact.id]),before=sideFacts.get(key);
      if(before!==undefined&&before!==row.side)throw new Error('left and right review axes cannot share one fact_id');
      sideFacts.set(key,row.side);
    }
  }
  if(!plan.changed_axes.length)throw new Error('inspection-only plans do not authorize a pixel edit');
  if(next.edit_scope&&next.edit_scope.baseline_reference_id!==baseline.id)throw new Error('existing edit scope uses a different baseline; refresh it explicitly');
  const prefix=`FRP:${plan.id}`,originalPosition=inputs.findIndex(ref=>ref.id===original.id)+1,baselinePosition=inputs.findIndex(ref=>ref.id===baseline.id)+1;
  function project(id,channel,text,question,critical=true,audit){
    if(next.requirements.some(row=>row.id===id)||next.acceptance.some(row=>row.id===`${id}:check`))throw new Error('face review ids conflict with existing production targets');
    next.requirements.push({id,channel,priority:critical?'must':'prefer',text,...(audit?{face_review_plan:audit}:{})});
    const label=`面容复查${channel==='identity'?'与身份':channel==='expression'?'与神态':channel==='makeup'?'与妆肤':channel==='lighting'?'与受光':channel==='hair'?'与发型':channel==='composition'?'与视角':channel==='style'?'与媒介':'与范围'}`;
    let section=next.sections.find(row=>row.label===label);
    if(section&&section.channel!==channel)throw new Error('face review section label conflicts with another channel');
    if(!section){section={label,channel,items:[]};next.sections.push(section);}
    section.items.push({text,basis:[id],intent:'constraint'});
    next.acceptance.push({id:`${id}:check`,basis:id,question,critical});
  }
  project(`${prefix}:context`,'task',`编辑输入图${baselinePosition}，输入图${originalPosition}是唯一人物身份来源；候选只作为编辑对象，未清楚显示的原结构不声明精准复刻。`,
    '是否始终依据原图保持本人，而候选仅作编辑对象，且未将生成细节升级为原图事实？',true,plan);
  const changeTexts=[],preserveTexts=[];
  for(const row of plan.axis_checks){
    const extent=row.review_extent==='visible_portion_only'?'仅在实际可见部分':'',goal=row.role==='change'?visualText(row.goal,faceControlCatalog()):null;
    const preserveSource=row.observation.reference_id===original.id?'原图':'编辑基准';
    const text=row.role==='change'?`${extent}调整${row.label}：${goal}`:row.role==='preserve'?`${extent}保留${preserveSource}的${row.label}：${row.observation.text}`:
      row.review_extent==='unavailable'?`${row.label}缺少当前可用的观察证据，仅记录待审，不由本次补绘宣称原图已确认。`:`复查${row.label}的可见表现，逐项记录结果，不自动判为合格。`;
    project(`${prefix}:axis:${row.selector}`,row.channel,text,`${row.label}是否符合本轮${row.role==='change'?'变化目标':row.role==='preserve'?'原图保持范围':'复查范围'}${extent?'，仅判断实际可见部分':''}？`,row.critical);
    if(row.role==='change')changeTexts.push(text);if(row.role==='preserve')preserveTexts.push(text);
  }
  for(const relation of plan.relationship_checks)project(`${prefix}:relationship:${relation.id}`,'task',`复查关联关系：${relation.question}本项不扩大获准变化范围。`,relation.question,false);
  next.edit_scope={baseline_reference_id:baseline.id,changes:unique(changeTexts),
    preserve:unique([...(next.edit_scope?.preserve??[]),'保持原图实际可辨认的稳定面容与年龄，不将候选升级为身份来源。',
      '本轮允许变化之外的现有构图、衣装、发型及环境保持；未知结构不声称精准复刻。',...preserveTexts])};
  compileProductionPrompt(next);
  return next;
}

export function validateFaceReviewChecks(inputOrPlan,review){
  const plan=rebuild(inputOrPlan);
  keys(review,['plan_sha256','checks'],'face review findings');
  if(review.plan_sha256!==plan.plan_sha256||!Array.isArray(review.checks)||review.checks.length!==plan.axis_checks.length)throw new Error('review findings must bind the exact plan and cover every selected axis');
  const seen=new Set();
  for(const check of review.checks){
    keys(check,['selector','verdict','evidence'],'face review check');
    const row=plan.axis_checks.find(axis=>axis.selector===check.selector);
    if(!row||seen.has(check.selector)||!['pass','fail','uncertain','not_assessable'].includes(check.verdict)||!nonempty(check.evidence))throw new Error('review findings need unique selected selectors and explicit evidence');
    if(row.review_extent==='unavailable'&&!['uncertain','not_assessable'].includes(check.verdict))throw new Error('unavailable original structure cannot acquire a pass or definite geometry verdict from a generated close-up');
    seen.add(check.selector);
  }
  return {status:'review_declarations_checked',plan_sha256:plan.plan_sha256,checks:structuredClone(review.checks),visual_quality_verified:false,user_accepted:false};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const command=process.argv[2],options={};
    for(let i=3;i<process.argv.length;i+=2){const key=process.argv[i];if(!['--input','--brief','--review','--out'].includes(key)||!process.argv[i+1]||Object.hasOwn(options,key))throw new Error('invalid face review CLI options');options[key]=process.argv[i+1];}
    if(!['build','apply','check'].includes(command)||!options['--input']||(command==='apply'&&!options['--brief'])||(command==='check'&&!options['--review'])||(command!=='apply'&&options['--brief'])||(command!=='check'&&options['--review']))
      throw new Error('usage: face-review-plan.mjs build --input plan.json | apply --input plan.json --brief brief.json | check --input plan.json --review findings.json [--out new.json]');
    const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),input=read(options['--input']);
    const result=command==='build'?buildFaceReviewPlan(input):command==='apply'?applyFaceReviewPlan(read(options['--brief']),input,{base_dir:path.dirname(path.resolve(options['--brief']))}):validateFaceReviewChecks(input,read(options['--review']));
    if(options['--out']){const out=path.resolve(options['--out']);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}else console.log(JSON.stringify(result,null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
