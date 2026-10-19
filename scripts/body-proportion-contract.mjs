// Explicit full-body scope and per-figure observations; no pixel analysis.
export const bodyRegions=Object.freeze({
  head_shoulders:'头肩与肩颈',torso_pelvis:'胸廓腰腹与骨盆',arms:'上下臂与手',
  legs:'上下腿与足',support:'肌肉软组织与承重',silhouette:'年龄体型与整体修长感'
});
const text=x=>typeof x==='string'&&x.trim().length>0;
export const normalizeBodyEvidence=x=>x.normalize('NFKC').replace(/[\s\p{P}]+/gu,'').toLowerCase();

export function withBodyRegionChecks(input,{targets,figures=[{id:'subject',view:'front',locator:'单人完整全身'}],baselineReferenceId,benchmark}={}){
  if(input?.subject_kind!=='character'||input.edit_scope)throw new Error('body design needs a new character target, not a narrow edit');
  if(!targets||Object.keys(targets).length!==Object.keys(bodyRegions).length||Object.keys(bodyRegions).some(key=>!text(targets[key])))throw new Error('author all six body region targets');
  if(!Array.isArray(figures)||!figures.length||figures.some(f=>!f||typeof f!=='object'))throw new Error('full-body plan needs unique figures with id, view and distinct visible locator');
  const next=structuredClone(input);
  if(next.body_plan!==undefined)throw new Error('body plan already exists; revise the complete body target explicitly');
  next.body_plan={framing:'full_body',figures:structuredClone(figures),...(baselineReferenceId?{baseline_reference_id:baselineReferenceId}:{}),...(benchmark!==undefined?{benchmark:structuredClone(benchmark)}:{})};
  if(next.acceptance.some(c=>c.body_region!==undefined)||next.requirements.some(r=>r.id.startsWith('BODY:')))throw new Error('body region plan already exists');
  const items=[];
  for(const [region,label]of Object.entries(bodyRegions)){
    const id=`BODY:${region}`,target=targets[region];
    next.requirements.push({id,channel:'proportion',priority:'must',text:target});
    items.push({text:target,basis:[id],intent:'design',reason:'依据本轮年龄、指定体型及可见范围，建立共同身体方案。'});
    for(const figure of figures)next.acceptance.push({id:figures.length===1?`${id}:check`:`${id}:${figure.id}:check`,basis:id,critical:true,body_region:region,figure_id:figure.id,
      question:`${figure.locator}的${label}是否达到本轮身体方案？记录本人物可见关系与相对目标的具体比较；无明显畸形不足以判定审美目标通过。`});
  }
  if(next.sections.some(s=>s.label==='身体方案'))throw new Error('body section already exists');
  next.sections.push({label:'身体方案',channel:'proportion',items});
  if(benchmark!==undefined){
    const comparison=`以${benchmark?.locator}为本轮比例标杆，比较其可见头肩、完整上身、四肢及体量关系；人物身份和当前衣装按各自设计。`;
    next.requirements.push({id:'BODY:benchmark',channel:'proportion',priority:'must',text:comparison});
    next.sections.push({label:'比例来源',channel:'proportion',items:[{text:comparison,basis:['BODY:benchmark'],intent:'constraint'}]});
    next.acceptance.push({id:'BODY:benchmark:check',basis:'BODY:benchmark',critical:true,question:'实际成片的可见身体关系是否对齐指定标杆？分开比较头肩、躯干与肢段，保留遮挡未知；参考已传入不等于比例已执行。'});
  }
  const layout=`画面内需分别检查的全身人物共${figures.length}个：${figures.map(f=>f.locator).join('；')}。每个人物分别遵守共同身体方案，不能用其中一人代替其余人物。`;
  next.requirements.push({id:'BODY:layout',channel:'composition',priority:'must',text:layout});
  next.sections.push({label:'全身人物范围',channel:'composition',items:[{text:layout,basis:['BODY:layout'],intent:'constraint'}]});
  next.acceptance.push({id:'BODY:layout:check',basis:'BODY:layout',critical:true,question:'声明的全身人物是否逐个出现且与位置对应，未用近景、重复人物或裁切掩盖缺失？'});
  assertBodyCriteria(next);
  return next;
}

export function assertBodyCriteria(input){
  const criteria=(input.acceptance??[]).filter(c=>c.body_region!==undefined);
  const plan=input.body_plan;
  if(plan!==undefined){
    if(!plan||typeof plan!=='object'||Array.isArray(plan)||Object.keys(plan).some(k=>!['framing','figures','baseline_reference_id','benchmark'].includes(k))||plan.framing!=='full_body'||
      !Array.isArray(plan.figures)||!plan.figures.length||plan.figures.some(f=>!f||Object.keys(f).some(k=>!['id','view','locator'].includes(k))||!text(f.id)||!['front','side','back','three_quarter'].includes(f.view)||!text(f.locator))||
      new Set(plan.figures.map(f=>f.id)).size!==plan.figures.length||new Set(plan.figures.map(f=>normalizeBodyEvidence(f.locator))).size!==plan.figures.length)
      throw new Error('full-body plan needs unique figures with id, view and distinct visible locator');
    if(plan.baseline_reference_id!==undefined){
      const ref=(input.references??[]).find(r=>r.id===plan.baseline_reference_id);
      if(!text(plan.baseline_reference_id)||!ref||ref.generation_input!==true||!ref.authority?.includes('proportion'))throw new Error('derived full-body plan needs an actual proportion baseline reference');
    }
    if(plan.benchmark!==undefined){
      const benchmark=plan.benchmark;
      if(!benchmark||typeof benchmark!=='object'||Array.isArray(benchmark)||Object.keys(benchmark).some(k=>!['reference_id','locator'].includes(k))||!text(benchmark.reference_id)||!text(benchmark.locator))
        throw new Error('body benchmark needs a reference_id and an explicit full-body locator');
      const ref=(input.references??[]).find(r=>r.id===benchmark.reference_id);
      if(!ref||ref.inspected!==true||ref.generation_input!==true||!ref.authority?.includes('proportion'))
        throw new Error('body benchmark must be an inspected actual proportion input, not an observation-only source');
      const requirement=input.requirements?.find(r=>r.id==='BODY:benchmark');
      if(requirement?.channel!=='proportion'||requirement.priority!=='must'||!(input.acceptance??[]).some(c=>c.basis==='BODY:benchmark'&&c.critical===true&&c.figure_id===undefined))
        throw new Error('body benchmark needs a critical must proportion comparison');
    }
    if(criteria.some(c=>!plan.figures.some(f=>f.id===c.figure_id)))throw new Error('body criterion must bind a declared figure');
    for(const c of input.acceptance??[])if(c.figure_id!==undefined&&!plan.figures.some(f=>f.id===c.figure_id))throw new Error('criterion uses unknown figure');
    const layout=input.requirements?.find(r=>r.id==='BODY:layout');
    if(layout?.channel!=='composition'||layout.priority!=='must'||!(input.acceptance??[]).some(c=>c.basis==='BODY:layout'&&c.critical===true&&c.figure_id===undefined))throw new Error('full-body plan needs a common critical layout count and locator check');
  }else if((input.acceptance??[]).some(c=>c.figure_id!==undefined))throw new Error('figure criteria need an explicit full-body plan');
  if(!criteria.length&&plan===undefined)return;
  if(input.subject_kind!=='character')throw new Error('body criteria require a character');
  const groups=plan?plan.figures.map(f=>criteria.filter(c=>c.figure_id===f.id)):[criteria];
  if(groups.some(group=>group.length!==Object.keys(bodyRegions).length||new Set(group.map(c=>c.body_region)).size!==group.length))throw new Error('body criteria need all six unique regions for every figure');
  for(const criterion of criteria){
    const requirement=input.requirements.find(r=>r.id===criterion.basis);
    if(!Object.hasOwn(bodyRegions,criterion.body_region)||criterion.critical!==true||requirement?.channel!=='proportion'||requirement.priority!=='must')throw new Error('body criteria require critical must proportion targets');
  }
}

export function bodyObservation(check){
  const observation=check.body_observation;
  if(!observation||!['visible','partial','not_visible'].includes(observation.visibility)||
    !text(observation.visible_relation)||!text(observation.target_comparison))throw new Error('body review needs visibility, visible_relation and target_comparison');
  if(check.verdict==='pass'&&observation.visibility!=='visible')throw new Error('occluded body target cannot be passed as fully observed');
  return {visibility:observation.visibility,visible_relation:observation.visible_relation,target_comparison:observation.target_comparison};
}

export function assertDistinctBodyEvidence(checks){
  const rows=checks.filter(c=>c.body_region!==undefined&&c.verdict==='pass');
  const signatures=rows.map(c=>normalizeBodyEvidence(c.body_observation.visible_relation+' '+c.body_observation.target_comparison));
  if(new Set(signatures).size!==signatures.length)throw new Error('body regions need distinct observed evidence, not copied all-pass prose');
}
