// Authored, visible targets only. Tags establish coverage, never semantic or image approval.
export const characterGoals = Object.freeze({
  elongated: {channel:'proportion',label:'修长比例',text:'未指定体型时，按人物年龄适度美化为轻盈挺拔、修长舒展的仙侠风格身形，以黄金比例的均衡感协调可见头肩、完整躯干和上下肢段；保持当前身份、衣装与媒介。获准纠正比例时可协调调整完整头部与身体的尺度，保留脸型和五官内部关系，不冻结被否定的旧头身关系；避免极端缩头、拉颈或单独拉腿。'},
  slender: {channel:'proportion',label:'苗条轮廓',text:'未指定体型时，在本年龄的骨架与软组织基础上适度整理苗条利落的轮廓，胸廓、腰腹和骨盆连续有厚度；不削成纸片或露骨细杆。明确的丰满、魁梧、矮小等体型优先保留，不统一改瘦改高；衣装沿既定结构呈现。'},
  muscle: {channel:'proportion',label:'肌肉支撑',text:'可见肌肉与软组织支撑符合人物年龄、指定体型和动作，线条自然连贯；儿童保留柔和体块，成人可适度紧致，年长者保留年龄体积特征，不过分硬刻或夸大肌肉，不穿透衣装推断隐藏结构。'},
  hair_natural: {channel:'hair',label:'发型自然度',text:'保持本套主要发型；发根与发际线衔接自然，主发量有体积，次级发束粗细疏密有变化，发梢自然收束，高光随朝向变化，避免硬壳、胶结和等距亮丝。'},
  face_readable: {channel:'hair',label:'面容可读性',text:'本视角实际可见的眉眼、鼻口与面容辨识点清楚，禁止过多碎发遮脸；少量细发留在鬓角和轮廓边缘，不为整洁抹去全部自然细发。'}
});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
// Authored apparent-age categories, not inferred biological ages or numeric ratios.
const ageDirections=Object.freeze({
  unspecified:'沿用已知表观年龄与可见骨架关系；年龄未明时不擅自套成人长腿细腰或强定数值头身。',
  infant:'婴幼儿保留较大的头部占比、短而柔软的四肢与圆润躯干；美化限于协调体块、自然姿态和轻盈感，不拉成成人仙侠体型。',
  child:'儿童保留相对较大的头部、尚未成熟的肩胸骨盆与柔和四肢；适度舒展姿态，不套成人长腿、细腰、胸臀曲线或分块肌肉。',
  adolescent:'少年保留未成熟的肩胸骨盆关系和自然生长感，肢段清秀舒展但不过分拉长，不套成熟成人胸臀曲线或厚重肌肉。',
  adult:'成年人以完整胸廓、腰腹和骨盆支撑轻盈挺拔的仙侠身形：头部相对全身精巧，肩颈自然舒展，躯干完整而紧凑，腰胯转折连贯，上下腿共同形成明显的时装级修长关系，上下臂同步协调，肌肉适度紧致；避免极小头、纸片腰与单段拉腿。修长应在头身、躯干与腿部的相对关系上可见，不能仅靠变瘦、抬裤腰或缩窄衣服达成。',
  older:'年长人物保留成熟骨架、肌肉量与软组织的年龄特征，在本人条件内舒展挺拔，不通过年轻化、削瘦或统一青年体型实现美化。'
});
export function characterGoalErrors(input) {
  const errors=[],rows=(input.requirements??[]).filter(row=>row?.character_goal!==undefined);
  const exceptions=input.character_exceptions??{};
  if(input.subject_kind!=='character')return rows.length||Object.keys(exceptions).length?['character goals and exceptions require subject_kind character']:[];
  if(!plain(exceptions))return ['character_exceptions must be an object'];
  for(const [goal,exception] of Object.entries(exceptions)){
    if(!Object.hasOwn(characterGoals,goal)||!plain(exception)||Object.keys(exception).some(k=>!['source','reason'].includes(k))||
       !['user_request','edit_scope','not_visible'].includes(exception.source)||!nonempty(exception.reason))errors.push(`invalid character exception: ${goal}`);
    else if(exception.source==='edit_scope'&&!input.edit_scope)errors.push(`character exception ${goal} needs an actual edit_scope`);
  }
  for(const row of rows)if(!Object.hasOwn(characterGoals,row.character_goal)||row.priority!=='must'||row.channel!==characterGoals[row.character_goal]?.channel)
    errors.push(`invalid character goal requirement: ${row.id}`);
  for(const [goal,definition] of Object.entries(characterGoals)){
    const selected=rows.filter(row=>row.character_goal===goal);
    if(selected.length>1)errors.push(`duplicate character goal: ${goal}`);
    if(exceptions[goal]&&selected.length)errors.push(`character goal ${goal} cannot also be exempted`);
    if(!selected.length&&!exceptions[goal])errors.push(`missing character goal: ${goal}; author its ${definition.channel} target or an explicit scoped exception`);
  }
  return errors;
}

// Agent-side construction helper. Compilation never injects or rewrites these clauses.
export function withCharacterGoals(input,{bindings={},exceptions={},texts={},ageStage='unspecified'}={}) {
  const next=structuredClone(input);
  if(next.subject_kind!=='character')return next;
  if(!Object.hasOwn(ageDirections,ageStage))throw new Error(`unknown body age stage: ${ageStage}`);
  for(const options of [bindings,exceptions,texts])if(!plain(options)||Object.keys(options).some(goal=>!Object.hasOwn(characterGoals,goal)))throw new Error('unknown character goal option');
  next.character_exceptions={...next.character_exceptions,...structuredClone(exceptions)};
  if(!Object.keys(next.character_exceptions).length)delete next.character_exceptions;
  const additions=new Map();
  for(const [goal,definition]of Object.entries(characterGoals)){
    if(next.character_exceptions?.[goal])continue;
    const existing=bindings[goal]?next.requirements.find(row=>row.id===bindings[goal]):next.requirements.find(row=>row.character_goal===goal);
    if(bindings[goal]&&!existing)throw new Error(`unknown character goal binding: ${bindings[goal]}`);
    if(existing){existing.character_goal=goal;continue;}
    if(next.edit_scope)throw new Error(`scoped edits need authored bindings or explicit exceptions for ${goal}; common goals cannot expand editing permission`);
    const id=`CQ:${goal}`,text=texts[goal]??(definition.channel==='proportion'?`${definition.text} ${ageDirections[ageStage]}`:definition.text);
    if(!nonempty(text)||next.requirements.some(row=>row.id===id))throw new Error(`invalid or duplicate character goal: ${goal}`);
    next.requirements.push({id,channel:definition.channel,priority:'must',character_goal:goal,text});
    const item={text,basis:[id],intent:'constraint'};
    additions.set(definition.channel,[...(additions.get(definition.channel)??[]),item]);
    next.acceptance.push({id:`${id}:check`,basis:id,critical:true,question:`本轮实际可见范围内，${definition.label}是否满足正文关系${definition.channel==='proportion'?'、年龄适配与指定体型':''}，且未越过编辑保护范围？`});
  }
  for(const [channel,items]of additions){
    const label=channel==='proportion'?'共同身材目标':'发型自然度与面容可读性';
    const existing=next.sections.find(section=>section.label===label);
    if(existing){if(existing.channel!==channel)throw new Error(`character goal label collision: ${label}`);existing.items.push(...items);}
    else next.sections.push({label,channel,items});
  }
  const errors=characterGoalErrors(next);if(errors.length)throw new Error(errors.join('\n'));
  return next;
}
