import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt, objectHash} from './production-prompt.mjs';

const mutable = ['hair','expression','makeup'];
const frontFields = ['parting','fringe','temples','outline'];
const performanceFields = ['gaze','brows','eyelids','mouth'];
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
    throw new Error('variation_channels must select hair, expression or makeup without duplicates');
  const base = input.base_brief;
  if (base?.subject_kind !== 'character' || base.edit_scope !== undefined) throw new Error('use a character base for new look targets, not an inherited narrow edit_scope');
  compileProductionPrompt(base);
  if (!base.requirements.some(row => row.channel === 'identity' && row.priority === 'must')) throw new Error('same-character looks need an authored stable identity requirement');
  if (base.requirements.some(row => mutable.includes(row.channel)) || base.sections.some(row => mutable.includes(row.channel)))
    throw new Error('clean inherited hair, expression and makeup channels; put fixed presentation clauses in shared');
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
    if (!mutable.includes(row.channel)) throw new Error('shared presentation clauses must use hair, expression or makeup');
  }
  const variants = [];
  for (const look of input.looks) {
    fields(look,['id','label','group','fit_reason','hair','expression','makeup'],'look');
    text(look.label,'look label'); text(look.fit_reason,'fit reason');
    if (groups.length ? !groups.some(row => row.id === look.group) : look.group !== undefined) throw new Error(`unknown look group: ${look.id}`);
    for (const channel of mutable) if (Object.hasOwn(look,channel) !== input.variation_channels.includes(channel))
      throw new Error(`look ${look.id} must author only its declared variation channels: ${channel}`);
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
    const brief = structuredClone(base);
    brief.request = `${input.request} 本套：${look.label}。`;
    brief.metadata = {...brief.metadata,portrait_look:{plan_id:input.id,look_id:look.id,group:look.group ?? null,fit_reason:look.fit_reason}};
    const clauses = new Map();
    const add = (channel, id, prose, intent, question) => {
      brief.requirements.push({id,channel,priority:'must',text:prose});
      const item = {text:prose,basis:[id],intent,...(intent === 'design' ? {reason:look.fit_reason} : {})};
      clauses.set(channel,[...(clauses.get(channel) ?? []),item]);
      brief.acceptance.push({id:`${id}:check`,basis:id,critical:true,question});
    };
    shared.forEach((row,index) => add(row.channel,`PL:${input.id}:shared:${index}`,row.text,'constraint',`是否满足共同保持要求：${row.text}`));
    if (look.hair) add('hair',`PL:${input.id}:${look.id}:hair`,look.hair.text,'design','本套额前分区、刘海、鬓角耳侧与正面轮廓是否符合所写设计，且关键眉眼鼻口仍可读？');
    if (look.expression) {
      const e = look.expression;
      add('expression',`PL:${input.id}:${look.id}:expression`,`${e.emotion}；${e.gaze}；${e.brows}；${e.eyelids}；${e.mouth}。`,'design',
        '视线、眉部、眼睑、嘴部是否实际形成所写情绪与神态，而非只换情绪名称？');
    }
    if (look.makeup !== undefined) add('makeup',`PL:${input.id}:${look.id}:makeup`,look.makeup,'design','本套眉眼妆、腮红、唇面与光泽是否实际落实，并与本人、发型和神态协调？');
    const labels = {hair:'发型与头饰',expression:'表情与情绪',makeup:'妆容与肌肤'};
    for (const [channel,items] of clauses) brief.sections.push({label:labels[channel],channel,items});
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
  return {status:diagnostics.length ? 'needs_revision' : 'text_plan_ready',plan_sha256:objectHash(input),count:variants.length,
    groups:groups.map(group => ({...group})),variation_channels:[...input.variation_channels],diagnostics,variants,
    evidence:{text_plan_only:true,image_generated:false,semantic_fit_verified:false,visual_diversity_verified:false,identity_preservation_verified:false}};
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
