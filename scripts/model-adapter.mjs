import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const catalog = JSON.parse(fs.readFileSync(new URL('../resources/image_model_catalog.json', import.meta.url), 'utf8'));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function listModelProfiles() { return structuredClone(catalog); }

function validateSetting(key, value, rule) {
  let valid = false;
  if (rule.enum) valid = rule.enum.includes(value);
  else if (rule.type === 'boolean') valid = typeof value === 'boolean';
  else if (rule.type === 'ratio') {
    valid = typeof value === 'string' && /^[1-9]\d{0,3}:[1-9]\d{0,3}$/.test(value);
    if(valid){const [w,h]=value.split(':').map(Number);valid=Math.max(w/h,h/w)<=14;}
  }
  else if (rule.type === 'openai-size') {
    valid = value === 'auto';
    if (typeof value === 'string' && /^\d+x\d+$/.test(value)) {
      const [w,h] = value.split('x').map(Number);
      valid = w > 0 && h > 0 && w % 16 === 0 && h % 16 === 0 && Math.max(w,h) <= 3840 && Math.max(w/h,h/w) <= 3 && w*h >= 655360 && w*h <= 8294400;
    }
  } else {
    valid = typeof value === 'number' && Number.isFinite(value) && value >= rule.min && value <= rule.max
      && (rule.type !== 'integer' || Number.isInteger(value)) && (!rule.multiple || value % rule.multiple === 0);
  }
  if (!valid) throw new Error(`模型设置 ${key} 的值不受支持：${JSON.stringify(value)}`);
}

// Pure compilation: no credentials, network, translation, truncation, or generation.
export function adaptModelPrompt(compiled, target) {
  if (!object(target) || Object.keys(target).some(k => !['profile','settings','negative_prompt'].includes(k))) throw new Error('target 只接受 profile、settings、negative_prompt');
  if (typeof target.profile !== 'string' || !Object.hasOwn(catalog.profiles, target.profile)) throw new Error(`未知模型适配：${target.profile}；先查询 model-list，不能静默回退`);
  const profile = catalog.profiles[target.profile];
  if (profile.retired_on) throw new Error(`${profile.label} 于 ${profile.retired_on} 停用；可明确选择 ${profile.replacement}，不会自动替换`);
  if (typeof compiled?.prompt !== 'string' || !compiled.prompt.trim() || !Array.isArray(compiled.reference_inputs)) throw new Error('适配需要已编译正文与参考输入');
  if (crypto.createHash('sha256').update(compiled.prompt).digest('hex') !== compiled.prompt_sha256) throw new Error('正文与摘要不一致');
  if (compiled.reference_inputs.length && profile.transport !== 'host') throw new Error('此适配器是文生图入口；不能丢弃参考图，须选择已核对的图像编辑入口');
  const settings = target.settings === undefined ? {} : target.settings;
  if (!object(settings)) throw new Error('settings 必须是对象');
  for (const [key,value] of Object.entries(settings)) {
    if (!Object.hasOwn(profile.settings, key)) throw new Error(`${profile.label} 不支持设置 ${key}；不得跨模型透传`);
    validateSetting(key,value,profile.settings[key]);
  }
  if (('width' in settings) !== ('height' in settings)) throw new Error('width 与 height 必须一起指定');
  if (profile.max_pixels && settings.width * settings.height > profile.max_pixels) throw new Error('尺寸超过该适配器允许的总像素数；不能静默缩小');
  if (settings.background === 'transparent' && settings.output_format === 'jpeg') throw new Error('透明背景不能使用 JPEG');
  const negative = target.negative_prompt;
  if (negative !== undefined && (typeof negative !== 'string' || (!negative.trim() && !(profile.family === 'qwen' && negative === ' ')))) throw new Error('negative_prompt 必须是非空字符串；Qwen 可显式用一个空格启用无排除词的负面分支');
  if (negative !== undefined && profile.negative === 'prose') throw new Error(`${profile.label} 无独立负面提示字段；请在正文中按要求编写可见的正向目标`);
  if (negative !== undefined && profile.transport === 'diffusers' && (settings[profile.family === 'qwen' ? 'true_cfg_scale' : 'guidance_scale'] ?? 1) <= 1) throw new Error('使用负面提示时显式设置对应引导强度大于 1，避免负面条件被忽略');
  if (profile.family === 'qwen' && settings.true_cfg_scale > 1 && negative === undefined) throw new Error('true_cfg_scale 大于 1 时需显式 negative_prompt；不要声称未启用的负面分支已生效');
  if (profile.transport === 'midjourney' && /--[a-z]|::/i.test(compiled.prompt + (negative ?? ''))) throw new Error('Midjourney 原生参数或权重须与正文分开，不能藏在正文或负面词中');
  const prompt = compiled.prompt, s = structuredClone(settings);
  let request, runtime = null;
  switch (profile.transport) {
    case 'host':
      request = {prompt, ...(compiled.reference_inputs.length ? {referenced_image_paths:compiled.reference_inputs.map(r=>r.source)} : {})}; break;
    case 'openai-images':
      request = {model:profile.model,prompt,...s}; break;
    case 'gemini-interactions':
      request = {model:profile.model,input:prompt,response_format:{type:'image',...s}}; break;
    case 'bfl': request = {prompt,...s}; break;
    case 'ark': request = {model:profile.model,prompt,sequential_image_generation:'disabled',...s}; break;
    case 'diffusers': {
      const {seed,...kwargs} = s;
      request = {prompt,...kwargs,...(negative !== undefined ? {negative_prompt:negative} : {})};
      runtime = {model:profile.model,...(seed !== undefined ? {generator_seed:seed} : {})}; break;
    }
    case 'midjourney': {
      const flags = [`--v ${profile.model}`];
      for (const [key,flag] of [['aspect_ratio','ar'],['seed','seed'],['stylize','stylize']]) if (s[key] !== undefined) flags.push(`--${flag} ${s[key]}`);
      if (s.raw === true) flags.push('--raw');
      if (negative !== undefined) flags.push(`--no ${negative}`);
      request = {prompt,parameter_suffix:flags.join(' '),submission_text:`${prompt}\n${flags.join(' ')}`}; break;
    }
    default: throw new Error('未实现的模型传输方式');
  }
  const plan = {schema_version:1,status:'request_ready',profile:target.profile,model:profile.model,transport:profile.transport,
    settings:s,negative_prompt:negative ?? null,prompt_sha256:compiled.prompt_sha256,request,runtime,
    documentation_verified_on:catalog.verified_on,sources:profile.sources,notes:profile.notes,
    evidence:{api_called:false,image_generated:false,visual_quality_verified:false}};
  return {...plan,execution_sha256:hash(plan)};
}

export function verifyModelPlan(plan) {
  if (!object(plan)) throw new Error('缺少模型执行计划');
  const {execution_sha256,...body} = plan;
  if (hash(body) !== execution_sha256) throw new Error('模型执行计划已变化');
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === 'list') console.log(JSON.stringify(listModelProfiles(),null,2));
  else { console.error('用法：node scripts/model-adapter.mjs list；通过 prompt-build 的 target 编译'); process.exitCode=1; }
}
