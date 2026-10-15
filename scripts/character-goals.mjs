// Authored, visible targets only. Tags establish coverage, never semantic or image approval.
export const characterGoals = Object.freeze({
  elongated: {channel:'proportion',label:'修长比例',text:'实际可见的头肩、肩颈、躯干和肢段相称、修长舒展，保留完整体积；不靠缩头、拉颈或单独拉腿凑比例。'},
  slender: {channel:'proportion',label:'苗条轮廓',text:'实际可见的身形苗条利落，轮廓自然收束且有连续厚度，不削成纸片或露骨细杆；衣装沿既定结构呈现。'},
  muscle: {channel:'proportion',label:'肌肉支撑',text:'实际可见的身体适当有肌肉与软组织支撑，线条紧致舒展，不过分硬刻或夸大肌肉，不穿透衣装推断隐藏结构。'},
  hair_natural: {channel:'hair',label:'发型自然度',text:'保持本套主要发型；发根与发际线衔接自然，主发量有体积，次级发束粗细疏密有变化，发梢自然收束，高光随朝向变化，避免硬壳、胶结和等距亮丝。'},
  face_readable: {channel:'hair',label:'面容可读性',text:'本视角实际可见的眉眼、鼻口与面容辨识点清楚，禁止过多碎发遮脸；少量细发留在鬓角和轮廓边缘，不为整洁抹去全部自然细发。'}
});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
export function characterGoalErrors(input) {
  const errors=[],rows=(input.requirements??[]).filter(row=>row.character_goal!==undefined);
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
export function withCharacterGoals(input,{bindings={},exceptions={},texts={}}={}) {
  const next=structuredClone(input);
  if(next.subject_kind!=='character')return next;
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
    const id=`CQ:${goal}`,text=texts[goal]??definition.text;
    if(!nonempty(text)||next.requirements.some(row=>row.id===id))throw new Error(`invalid or duplicate character goal: ${goal}`);
    next.requirements.push({id,channel:definition.channel,priority:'must',character_goal:goal,text});
    const item={text,basis:[id],intent:'constraint'};
    additions.set(definition.channel,[...(additions.get(definition.channel)??[]),item]);
    next.acceptance.push({id:`${id}:check`,basis:id,critical:true,question:`本轮实际可见范围内，${definition.label}是否满足正文关系，且未越过编辑保护范围？`});
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
