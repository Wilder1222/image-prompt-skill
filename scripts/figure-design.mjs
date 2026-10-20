// Authored design targets, not image measurements or automatic visual approval.
export const fabrics = Object.freeze({
  denim:{name:'棉质牛仔布',thickness:'中厚',weight:'较重',drape:'较挺括，衣摆受自重下垂，接缝处保留支撑',folds:'肘膝与坐折处形成较宽的折线和受力堆褶',en:'medium-thick, relatively heavy cotton denim; structured gravity-led drape, supported seams and broad stress folds at elbows, knees and sitting creases'},
  knit:{name:'羊毛针织',thickness:'中等厚度',weight:'中等重量',drape:'柔软且有弹性，自重下垂，肩部与袖口保留回弹',folds:'弯曲处形成圆缓褶皱，针目随伸展轻微张开',en:'medium-thickness, medium-weight wool knit; soft elastic drape, spring at shoulders and cuffs, rounded folds and slightly opened stitches under stretch'},
  silk:{name:'真丝素绉缎',thickness:'薄',weight:'轻',drape:'柔顺贴合，沿悬垂方向自然落下，反光随面料朝向移动',folds:'形成细软流动褶皱，缝边和叠压处有克制厚度',en:'thin, lightweight silk crepe satin; supple gravity-led drape, directional sheen, fine flowing folds and restrained thickness at seams and overlaps'},
  brocade:{name:'真丝织锦',thickness:'中厚',weight:'较重',drape:'有织造支撑和垂重，不像薄纱悬浮',folds:'形成宽而稳定的褶面，织纹与纹样随衣片弯折',en:'medium-thick, relatively heavy silk brocade; supported weighted drape, broad stable folds and woven motifs following panel curvature'},
  cotton:{name:'棉质府绸',thickness:'中薄',weight:'较轻',drape:'略挺且有支撑，衣片受重力自然垂落',folds:'缝线与弯肘处形成清楚但不僵硬的折褶',en:'medium-thin, relatively light cotton poplin; lightly crisp supported drape and clear, flexible seam and elbow creases'},
  linen:{name:'亚麻平纹布',thickness:'中等厚度',weight:'中等重量',drape:'干爽略挺，沿人体和重力形成疏松垂落',folds:'保留不均匀的自然折皱与可读经纬纹理',en:'medium-thickness, medium-weight plain-weave linen; dry slightly crisp loose drape, irregular natural creases and readable weave'},
  wool:{name:'羊毛呢',thickness:'厚',weight:'较重',drape:'衣片有体积和垂重，肩领保持版型',folds:'形成宽缓厚褶与有厚度的叠边',en:'thick, relatively heavy wool cloth; volumetric weighted drape, shaped shoulders and collar, broad soft folds and substantial overlaps'},
  gauze:{name:'真丝薄纱',thickness:'薄',weight:'很轻',drape:'轻透，受重力和当前动作轻柔偏移，不无风持续飘浮',folds:'细密柔软褶皱与薄而可读的叠边',en:'thin, very light silk gauze; translucent gravity-led drape responding to movement, fine soft folds and thin readable overlaps'},
  leather:{name:'皮革',thickness:'中厚',weight:'较重',drape:'有韧性和支撑，按裁片与接缝受重力弯曲',folds:'关节处形成圆钝受力褶，边缘保持厚度',en:'medium-thick, relatively heavy leather; resilient supported panels, gravity-led bending at seams, rounded stress folds and substantial edges'}
});
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const keys=(x,list)=>plain(x)&&Object.keys(x).every(k=>list.includes(k));

export function planFigureDesign(options={}) {
  if(!keys(options,['age_stage','framing','proportion_mode','target_head_count','reason','garments','body_shape']))throw new Error('unknown figure design option');
  const {age_stage='unspecified',framing='visible',proportion_mode='default',target_head_count,reason,garments=[],body_shape}=options;
  if(!['infant','child','adolescent','adult','older','unspecified'].includes(age_stage)||!['full_body','portrait','visible'].includes(framing)||!['default','user','reference_locked'].includes(proportion_mode))throw new Error('invalid figure design age, framing or proportion mode');
  const adult=['adult','older'].includes(age_stage),full=framing==='full_body',warnings=[];
  if(proportion_mode!=='default'&&!nonempty(reason))throw new Error('比例覆盖或身体锁定需要明确用户来源 reason，不能静默改写');
  if(target_head_count!==undefined&&(!Number.isFinite(target_head_count)||target_head_count<=0))throw new Error('target_head_count 必须是有限正数');
  if(target_head_count!==undefined&&(!adult||!full))throw new Error('肖像、未成年或年龄未知任务不能套用完整成人数值头身比');
  if(proportion_mode==='reference_locked'&&target_head_count!==undefined)throw new Error('身体锁定与新头身数值冲突：先明确用户取舍，不猜参考测量');
  if(proportion_mode==='user'&&adult&&full&&target_head_count===undefined)throw new Error('成年全身用户比例需要具体数值');
  if(body_shape!==undefined&&(!nonempty(body_shape)||proportion_mode!=='user'))throw new Error('指定体型需要 user 模式与明确 body_shape，不能藏在默认细腰曲线中');
  if(body_shape!==undefined&&(!adult||!full))throw new Error('body_shape 仅用于明确成年全身体型，其他范围请撰写年龄适配的可见要求');
  const head=adult&&full&&proportion_mode!=='reference_locked'?(target_head_count??8.5):null;
  if(proportion_mode==='default'&&head!==null&&(head<8||head>9))throw new Error('成年全身默认头身比必须在 8–9，明确用户比例请用 user 并说明来源');
  if(proportion_mode==='user'&&head===null&&adult&&full)throw new Error('成年全身用户比例需要具体数值');
  if(proportion_mode==='user'&&head!==null&&(head<8||head>9))warnings.push(`用户指定 ${head} 头身优先，超出本轮默认 8–9；未改成 8.5。`);
  let body,en;
  if(proportion_mode==='reference_locked'){
    body='保持参考中当前可见的身体比例与体型，不重新收腰、抬臀、缩头或拉腿；身份和服装结构保持连续。';
    en='Preserve the reference body proportions and type in the visible area, without new waist narrowing, hip shaping, head shrinking or leg stretching; retain identity and garment construction.';
    warnings.push('身体锁定优先，8.5 头身及成人曲线默认未应用；参考完整头身比未经测量，不补造数值。');
  }else if(head!==null){
    body=`身材造型目标为 ${head} 头身：按颅顶至下巴的头长协调完整身体，不计发量、头饰、鞋跟和拖尾。${body_shape??'整体修长舒展，呈现黄金比例的均衡美感，细腰自然收束，臀部曲线自然饱满且与骨盆连续'}，躯干完整，肩颈与上下肢段协调，保留肌肉和软组织厚度；不靠极端缩头、纸片腰或单段拉腿凑比例。保持脸型与五官内部关系、人物身份和当前媒介。${age_stage==='older'?'保留年长者的骨架与软组织特征，不统一年轻化。':''}`;
    en=`Use a ${head}-head body proportion as the styling target, based on crown-to-chin head length excluding hair, ornaments, heels and trains. ${body_shape??'Create an elongated balanced figure, a naturally slender waist and naturally full hip contours continuous with the pelvis'}; retain a complete torso, coherent shoulders and limbs, muscle and soft-tissue volume. Preserve face shape, internal facial relationships, identity and medium.${age_stage==='older'?' Retain older skeletal and soft-tissue characteristics without rejuvenation.':''}`;
    if(body_shape)warnings.push('指定体型优先，默认细腰与饱满臀部曲线未强加；请按该体型验收。');
  }else if(!adult){
    body='按已知表观年龄和当前可见骨架设计自然、非性化的身体比例；未成年保留生长阶段的头肩、躯干与肢段关系，年龄未知不擅自指定成人头身数或强调胸臀曲线。保持人物身份和本轮取景。';
    en='Use natural, non-sexualized body proportions for the known apparent age and visible skeleton. Preserve immature growth-stage relationships; unknown age does not authorize adult head ratios or emphasized mature curves. Retain identity and framing.';
  }else{
    body='仅协调本画幅实际可见的头颈肩与上身体积，保持自然连接和人物身份；不扩成全身，不补写遮挡腰臀，不声称当前肖像展示或验证完整头身比。';
    en='Coordinate only the head, neck, shoulders and upper-body volume actually visible in this framing. Preserve natural connections and identity, without expanding to full body, inventing hidden hips or claiming a complete head ratio is visible or verified.';
  }
  if(!Array.isArray(garments))throw new Error('garments 必须是明确衣片与面料数组');
  const seen=new Set(),cloth=garments.map(g=>{
    if(!keys(g,['id','part','fabric'])||!nonempty(g.id)||!nonempty(g.part)||!Object.hasOwn(fabrics,g.fabric)||seen.has(g.id))throw new Error('服装须有唯一 id、具体 part 和支持的真实 fabric，不能只写真实材质');
    seen.add(g.id);const f=fabrics[g.fabric];
    return {id:g.id,zh:`${g.part}采用${f.name}，${f.thickness}、${f.weight}；${f.drape}，${f.folds}。沿用指定衣片、缝线、叠压和穿着关系，不以换材质或统一轻薄飘逸改变服装设计。`,en:`For ${g.part}, use ${f.en}. Retain the specified panels, seams, overlaps and wearing relationships; do not substitute fabric or make every material light and floating.`};
  });
  return {contract:{age_stage,framing,proportion_mode,...(head!==null?{target_head_count:head}:{}),...(reason!==undefined?{reason}:{}),...(body_shape!==undefined?{body_shape}:{}),garments:structuredClone(garments)},body,en,cloth,warnings};
}

export function withFigureDesign(input,options){
  if(input.subject_kind!=='character')throw new Error('figure design requires character');
  if(input.edit_scope)throw new Error('figure design helper cannot expand a local edit scope；请单独撰写局部衣料或身体保护要求');
  if(input.figure_design!==undefined)throw new Error('figure_design 已存在，需显式重写完整目标而非叠加');
  const next=structuredClone(input),plan=planFigureDesign(options);
  const prior=next.requirements.filter(r=>r.channel==='proportion').flatMap(r=>[...(r.target_head_count===undefined?[]:[r.target_head_count]),...[...r.text.matchAll(/(\d+(?:\.\d+)?)\s*头身/g)].map(m=>Number(m[1]))]);
  if(prior.some(n=>n!==plan.contract.target_head_count))throw new Error('已有明确头身数值与新比例冲突：先明确 user 比例或身体锁定取舍，不覆盖原要求');
  if(next.character_exceptions?.elongated&&plan.contract.proportion_mode==='default')throw new Error('既有指定体型/范围例外与 8.5 默认冲突；先说明 user 或 reference_locked 取舍');
  if(next.sections.some(s=>s.channel==='costume')&&!plan.cloth.length)throw new Error('有可见服装时必须具体选择面料，不能省略厚薄、重量、垂感和褶皱');
  next.figure_design=plan.contract;
  const add=(id,channel,label,value)=>{
    if(next.requirements.some(r=>r.id===id))throw new Error('duplicate figure design requirement');
    next.requirements.push({id,channel,priority:'must',text:value,...(id==='FIG:body'&&plan.contract.target_head_count!==undefined?{target_head_count:plan.contract.target_head_count}:{})});
    next.sections.push({label,channel,items:[{text:value,basis:[id],intent:'constraint'}]});
    next.acceptance.push({id:`${id}:check`,basis:id,critical:true,question:id==='FIG:body'?'可见身体是否符合本轮数值造型目标、年龄、取景和锁定范围？数值为设计要求，未实测不宣称精确实现。':'对应衣片的具体面料、厚薄、重量、垂感与受力褶皱是否成立，且未擅自更换材料或衣片？'});
  };
  add('FIG:body','proportion','本轮明确身体造型',plan.body);
  for(const [i,g]of plan.cloth.entries())add(`FIG:fabric:${g.id}`,'material',`服装面料与垂感 ${i+1}`,g.zh);
  return next;
}

export function assertFigureDesign(input){
  const contract=input.figure_design;
  if(contract===undefined){
    if(input.requirements?.some(r=>r.id?.startsWith('FIG:')))throw new Error('figure_design 被移除，不能绕过当前身体与面料契约');
    return null; // Historical authored briefs remain unchanged; not certified against the new contract.
  }
  if(input.subject_kind!=='character'||!keys(contract,['age_stage','framing','proportion_mode','target_head_count','reason','garments','body_shape']))throw new Error('invalid figure_design contract');
  if(input.body_plan&&contract.framing!==input.body_plan.framing)throw new Error('figure_design 取景与现有 full-body plan 冲突，不能用肖像声明隐藏全身目标');
  const plan=planFigureDesign(contract);
  const prose=input.prompt??input.sections?.flatMap(s=>s.items?.map(i=>i.text)??[]).join('\n')??'';
  for(const [id,channel,value]of [['FIG:body','proportion',plan.body],...plan.cloth.map(g=>[`FIG:fabric:${g.id}`,'material',g.zh])]){
    const r=input.requirements?.find(r=>r.id===id);
    if(r?.channel!==channel||r.priority!=='must'||r.text!==value||!prose.includes(value)||!input.acceptance?.some(c=>c.basis===id&&c.critical===true))throw new Error(`figure design 正文、must 与关键验收缺失或改变：${id}`);
  }
  if(input.sections?.some(s=>s.channel==='costume')&&!plan.cloth.length)throw new Error('可见服装缺少具体面料与垂感设计');
  return {warnings:plan.warnings,head_count_target:plan.contract.target_head_count??null,measurement_verified:false};
}
