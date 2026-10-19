import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt, objectHash} from './production-prompt.mjs';

const mutable = ['hair','expression','makeup','action'];
const frontFields = ['parting','fringe','temples','outline'];
const performanceFields = ['gaze','brows','eyelids','mouth'];
const actionFields = ['head','torso','hands','support'];
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const normalized = value => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu,' ');
const positive = value => Number.isSafeInteger(value) && value > 0;
function fields(value, allowed, label) {
  if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`unsupported ${label} fields`);
}
function text(value, label) { if (!nonempty(value)) throw new Error(`${label} needs nonempty text`); }
function uniqueIds(rows, label) {
  const ids = rows.map(row => row.id);
  if (ids.some(id => !nonempty(id)) || new Set(ids).size !== ids.length) throw new Error(`${label} needs unique nonempty ids`);
}

// Compare authored declarations only; no image understanding or automatic styling.
export function buildPortraitLookPlan(input) {
  fields(input,['id','request','identity_mode','count','variation_channels','groups','shared','base_brief','looks','metadata'],'portrait look plan');
  text(input.id,'plan id'); text(input.request,'plan request');
  if (input.identity_mode !== 'same_character') throw new Error('portrait look planning currently supports one same-character identity only');
  if (!positive(input.count) || input.count < 2 || !Array.isArray(input.looks) || input.looks.length !== input.count)
    throw new Error('look count must be at least two and match the requested count');
  if (!Array.isArray(input.variation_channels) || !input.variation_channels.length ||
      new Set(input.variation_channels).size !== input.variation_channels.length || input.variation_channels.some(channel => !mutable.includes(channel)))
    throw new Error('variation_channels must select hair, expression, makeup or action without duplicates');
  const base = input.base_brief;
  if (base?.subject_kind !== 'character' || base.edit_scope !== undefined) throw new Error('use a character base for new look targets, not an inherited narrow edit_scope');
  compileProductionPrompt(base);
  if (!base.requirements.some(row => row.channel === 'identity' && row.priority === 'must')) throw new Error('same-character looks need an authored stable identity requirement');
  const commonGoals=new Set(base.requirements.filter(row=>row.character_goal).map(row=>row.id));
  const projected=mutable.filter(channel=>channel!=='action'||input.variation_channels.includes('action'));
  if (base.requirements.some(row => projected.includes(row.channel)&&!row.character_goal) || base.sections.some(row => projected.includes(row.channel)&&row.items.some(item=>item.basis.some(id=>!commonGoals.has(id)))))
    throw new Error('clean inherited hair, expression, makeup and varying action channels; put fixed presentation clauses in shared');
  const groups = input.groups ?? [], shared = input.shared ?? [];
  if (!Array.isArray(groups) || !Array.isArray(shared)) throw new Error('groups and shared must be arrays');
  for (const group of groups) {
    fields(group,['id','label','count'],'look group'); text(group.label,'group label');
    if (!positive(group.count)) throw new Error('group count must be a positive integer');
  }
  uniqueIds(groups,'look groups'); uniqueIds(input.looks,'looks');
  if (groups.length && groups.reduce((sum, row) => sum + row.count,0) !== input.count) throw new Error('group counts must sum to the requested count');
  for (const row of shared) {
    fields(row,['channel','text'],'shared clause'); text(row.text,'shared clause');
    if (!mutable.includes(row.channel)) throw new Error('shared presentation clauses must use hair, expression, makeup or action');
  }
  const variants = [];
  for (const look of input.looks) {
    fields(look,['id','label','group','fit_reason',...mutable,'focus_channels','detail_policy'],'look');
    text(look.label,'look label'); text(look.fit_reason,'fit reason');
    if (groups.length ? !groups.some(row => row.id === look.group) : look.group !== undefined) throw new Error(`unknown look group: ${look.id}`);
    for (const channel of mutable) if (Object.hasOwn(look,channel) !== input.variation_channels.includes(channel))
      throw new Error(`look ${look.id} must author only its declared variation channels: ${channel}`);
    const policy=look.detail_policy;
    if(policy!==undefined){
      fields(policy,['critical','reason'],'look detail policy');text(policy.reason,'detail policy reason');
      const details=input.variation_channels.flatMap(channel=>channel==='hair'?[...frontFields.map(f=>`hair:${f}`),'hair']:channel==='action'?actionFields.map(f=>`action:${f}`):[channel]);
      if(!Array.isArray(policy.critical)||!policy.critical.length||new Set(policy.critical).size!==policy.critical.length||policy.critical.some(key=>!details.includes(key)))throw new Error('detail policy needs unique supported critical details');
      if(input.variation_channels.some(channel=>!policy.critical.some(key=>key===channel||key.startsWith(`${channel}:`))))throw new Error('detail policy must retain a critical target for every variation channel');
    }
    const focus=look.focus_channels??[];
    if(!Array.isArray(focus)||new Set(focus).size!==focus.length||focus.some(channel=>!input.variation_channels.includes(channel)))
      throw new Error('focus_channels must select declared variation channels without duplicates');
    if (look.hair) {
      fields(look.hair,['front','text'],'hair design'); fields(look.hair.front,frontFields,'front hair design');
      for (const field of frontFields) text(look.hair.front[field],`front hair ${field}`);
      text(look.hair.text,'hair design');
    }
    if (look.expression) {
      fields(look.expression,['emotion',...performanceFields],'expression');
      for (const field of ['emotion',...performanceFields]) text(look.expression[field],`expression ${field}`);
    }
    if (look.makeup !== undefined) text(look.makeup,'makeup design');
    if (look.action !== undefined) {
      fields(look.action,actionFields,'action design');
      for (const field of actionFields) text(look.action[field],`action ${field}`);
    }
    const brief = structuredClone(base);
    brief.request = `${input.request} 本套：${look.label}。`;
    brief.metadata = {...brief.metadata,portrait_look:{plan_id:input.id,look_id:look.id,group:look.group ?? null,fit_reason:look.fit_reason,...(policy?{detail_policy:structuredClone(policy)}:{})}};
    const clauses = new Map();
    const add = (channel, id, prose, intent, question, detailKey) => {
      const critical=detailKey===undefined||policy===undefined||policy.critical.includes(detailKey);
      brief.requirements.push({id,channel,priority:critical?'must':'prefer',text:prose});
      const item = {text:prose,basis:[id],intent,...(intent === 'design' ? {reason:look.fit_reason} : {})};
      clauses.set(channel,[...(clauses.get(channel) ?? []),item]);
      brief.acceptance.push({id:`${id}:check`,basis:id,critical,question});
    };
    shared.forEach((row,index) => add(row.channel,`PL:${input.id}:shared:${index}`,row.text,'constraint',`是否满足共同保持要求：${row.text}`));
    if (look.hair) {
      const frontLabels={parting:'额前分区与露额',fringe:'刘海结构',temples:'鬓角与耳侧',outline:'正面轮廓'};
      for(const field of frontFields){
        if(!/[\u3400-\u9fff]/u.test(look.hair.front[field]))throw new Error(`front hair ${field} needs visible Chinese prose, not an internal signature code`);
        add('hair',`PL:${input.id}:${look.id}:hair:${field}`,`${frontLabels[field]}：${look.hair.front[field]}`,'design',`本套实际可见的${frontLabels[field]}是否符合正文设计？`,`hair:${field}`);
      }
      add('hair',`PL:${input.id}:${look.id}:hair`,look.hair.text,'design','后部扎束、附件及发束衔接是否符合本套补充设计，且没有覆盖脸前设计？','hair');
    }
    if (look.expression) {
      const e = look.expression;
      add('expression',`PL:${input.id}:${look.id}:expression`,`${e.emotion}；${e.gaze}；${e.brows}；${e.eyelids}；${e.mouth}。`,'design',
        '视线、眉部、眼睑、嘴部是否实际形成所写情绪与神态，而非只换情绪名称？','expression');
    }
    if (look.makeup !== undefined) add('makeup',`PL:${input.id}:${look.id}:makeup`,look.makeup,'design','本套眉眼妆、腮红、唇面与光泽是否实际落实，并与本人、发型和神态协调？','makeup');
    if (look.action) {
      const actionLabels={head:'头部朝向与倾斜',torso:'肩胸与躯干',hands:'手臂与手势',support:'重心与支撑'};
      for (const field of actionFields)
        add('action',`PL:${input.id}:${look.id}:action:${field}`,`${actionLabels[field]}：${look.action[field]}`,'design',`本套实际可见的${actionLabels[field]}是否符合正文，且没有沿用身体基准或其他造型的旧姿态？`,`action:${field}`);
    }
    const labels = {hair:'发型与头饰',expression:'表情与情绪',makeup:'妆容与肌肤',action:'身体姿态与动作'};
    for (const [channel,items] of clauses) {
      const common=brief.sections.filter(section=>section.channel===channel);
      brief.sections=brief.sections.filter(section=>section.channel!==channel);
      brief.sections.push({label:labels[channel],channel,items:[...common.flatMap(section=>section.items),...items]});
    }
    // Emphasize existing complete sections, never add a second styling summary.
    if(focus.length){
      const leading=focus.flatMap(channel=>brief.sections.filter(section=>section.channel===channel));
      brief.sections=brief.sections.filter(section=>!focus.includes(section.channel));
      const identityEnd=brief.sections.findLastIndex(section=>section.channel==='identity')+1;
      brief.sections.splice(identityEnd,0,...leading);
    }
    const compiled = compileProductionPrompt(brief);
    variants.push({id:look.id,label:look.label,group:look.group ?? null,fit_reason:look.fit_reason,brief,prompt:compiled.prompt,prompt_sha256:compiled.prompt_sha256});
  }
  for (const group of groups) if (input.looks.filter(look => look.group === group.id).length !== group.count) throw new Error(`look group count mismatch: ${group.id}`);
  const diagnostics = [];
  const repeated = (channel, code, signature) => {
    if (!input.variation_channels.includes(channel)) return;
    const sets = new Map();
    for (const look of input.looks) {
      const key = JSON.stringify(signature(look));
      sets.set(key,[...(sets.get(key) ?? []),look.id]);
    }
    for (const look_ids of sets.values()) if (look_ids.length > 1) diagnostics.push({code,look_ids});
  };
  repeated('hair','repeated_front_hair',look => frontFields.map(field => normalized(look.hair.front[field])));
  repeated('hair','repeated_hair_prose',look => normalized(look.hair.text));
  repeated('expression','repeated_expression_performance',look => performanceFields.map(field => normalized(look.expression[field])));
  repeated('makeup','repeated_makeup_prose',look => normalized(look.makeup));
  // A new head tilt alone does not make the body's performance a different pose.
  // Shared upright heads are allowed when torso, hands or support actually differ.
  repeated('action','repeated_body_action',look => ['torso','hands','support'].map(field => normalized(look.action[field])));
  return {status:diagnostics.length ? 'needs_revision' : 'text_plan_ready',plan_sha256:objectHash(input),count:variants.length,
    groups:groups.map(group => ({...group})),variation_channels:[...input.variation_channels],diagnostics,variants,
    evidence:{text_plan_only:true,image_generated:false,semantic_fit_verified:false,visual_diversity_verified:false,identity_preservation_verified:false}};
}

// Revise the current authored look, carrying its other channels instead of rebuilding
// a partial focus paragraph from the original identity photograph.
export function revisePortraitLookPlan(input,revision){
  const before=buildPortraitLookPlan(input);
  fields(revision,['look_id','channels','updates','focus_channels','reason'],'portrait look revision');
  text(revision.reason,'revision reason');
  if(!Array.isArray(revision.channels)||!revision.channels.length||new Set(revision.channels).size!==revision.channels.length||
    revision.channels.some(channel=>!input.variation_channels.includes(channel)))throw new Error('revision must select authorized variation channels');
  fields(revision.updates,revision.channels,'portrait look updates');
  if(Object.keys(revision.updates).length!==revision.channels.length)throw new Error('author a complete update for every selected channel');
  const plan=structuredClone(input),look=plan.looks.find(row=>row.id===revision.look_id);
  if(!look)throw new Error('unknown portrait look');
  for(const channel of revision.channels)look[channel]=structuredClone(revision.updates[channel]);
  look.focus_channels=structuredClone(revision.focus_channels??revision.channels);
  plan.metadata={...plan.metadata,portrait_revision:{previous_plan_sha256:before.plan_sha256,look_id:look.id,channels:[...revision.channels],reason:revision.reason}};
  return {plan,report:buildPortraitLookPlan(plan)};
}

export function renderPortraitLookPrompts(report) {
  if (report.status !== 'text_plan_ready') throw new Error('resolve repeated look declarations before delivering prompts');
  return report.variants.map(look => `## ${look.label}\n\n\`\`\`text\n${look.prompt}\n\`\`\`\n`).join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = {};
    for (let i=0;i<args.length;i+=2) {
      if (!['--input','--format'].includes(args[i]) || !args[i+1] || Object.hasOwn(options,args[i])) throw new Error('usage: portrait-look-plan.mjs --input plan.json [--format json|text]');
      options[args[i]] = args[i+1];
    }
    if (!options['--input'] || !['json','text'].includes(options['--format'] ?? 'json')) throw new Error('input is required; format must be json or text');
    const report = buildPortraitLookPlan(JSON.parse(fs.readFileSync(options['--input'],'utf8')));
    console.log(options['--format'] === 'text' ? renderPortraitLookPrompts(report) : JSON.stringify(report,null,2));
    if (report.status !== 'text_plan_ready') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
