// Optional full-body asset contract. Authored observations are not pixel analysis.
export const bodyRegions=Object.freeze({
  head_shoulders:'头肩与肩颈',torso_pelvis:'胸廓腰腹与骨盆',arms:'上下臂与手',
  legs:'上下腿与足',support:'肌肉软组织与承重',silhouette:'年龄体型与整体修长感'
});
const text=x=>typeof x==='string'&&x.trim().length>0;
export const normalizeBodyEvidence=x=>x.normalize('NFKC').replace(/[\s\p{P}]+/gu,'').toLowerCase();

export function withBodyRegionChecks(input,{targets}={}){
  if(input?.subject_kind!=='character'||input.edit_scope)throw new Error('body design needs a new character target, not a narrow edit');
  if(!targets||Object.keys(targets).length!==Object.keys(bodyRegions).length||Object.keys(bodyRegions).some(key=>!text(targets[key])))throw new Error('author all six body region targets');
  const next=structuredClone(input);
  if(next.acceptance.some(c=>c.body_region!==undefined)||next.requirements.some(r=>r.id.startsWith('BODY:')))throw new Error('body region plan already exists');
  const items=[];
  for(const [region,label]of Object.entries(bodyRegions)){
    const id=`BODY:${region}`,target=targets[region];
    next.requirements.push({id,channel:'proportion',priority:'must',text:target});
    items.push({text:target,basis:[id],intent:'design',reason:'依据本轮年龄、指定体型及可见范围，建立共同身体方案。'});
    next.acceptance.push({id:`${id}:check`,basis:id,critical:true,body_region:region,
      question:`${label}是否达到本轮身体方案？记录可见关系与相对目标的具体比较；无明显畸形不足以判定审美目标通过。`});
  }
  if(next.sections.some(s=>s.label==='身体方案'))throw new Error('body section already exists');
  next.sections.push({label:'身体方案',channel:'proportion',items});
  return next;
}

export function assertBodyCriteria(input){
  const criteria=(input.acceptance??[]).filter(c=>c.body_region!==undefined);
  if(!criteria.length)return;
  if(input.subject_kind!=='character')throw new Error('body criteria require a character');
  if(criteria.length!==Object.keys(bodyRegions).length||new Set(criteria.map(c=>c.body_region)).size!==criteria.length)throw new Error('body criteria need all six unique regions');
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
