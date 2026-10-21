// Offline manual-paste compiler. Never fetches URLs, uploads, or submits jobs.
import {isIP} from 'node:net';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const aliases = {ar:'aspect_ratio',aspect:'aspect_ratio',s:'stylize',c:'chaos',w:'weird',q:'quality',iw:'image_weight',sw:'style_weight',sv:'style_version',ow:'omni_weight',p:'personalization',sref:'style_reference'};
export function normalizeMidjourneySettings(settings) {
  const result = Object.create(null);
  for (const [name,value] of Object.entries(settings)) {
    let key = Object.hasOwn(aliases,name) ? aliases[name] : name, next = value;
    if (['hd','sd'].includes(name)) {
      if (typeof value !== 'boolean') throw new Error(`${name} 必须是布尔值`);
      if (!value) continue;
      key = 'resolution'; next = name;
    }
    if (Object.hasOwn(result,key)) throw new Error(`重复或冲突的 Midjourney 设置：${key}；每项只指定一次`);
    result[key] = next;
  }
  return result;
}

function imageUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('参考 URL 必须是真实 HTTP(S) 图片地址；不能使用本地路径、Library ID 或占位符'); }
  const host = url.hostname.replace(/^\[|\]$/g,''), ip = isIP(host);
  const privateHost = host === 'localhost' || (ip === 4 && /^(127\.|10\.|192\.168\.|0\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) ||
    (ip === 6 && (/^(::1|::)$/.test(host) || /^(fc|fd|fe[89ab]|::ffff:)/i.test(host)));
  if (typeof value !== 'string' || /[\s<>"'`{}\\]/.test(value) || !['http:','https:'].includes(url.protocol) ||
      url.username || url.password || url.hash || !/\.(png|gif|webp|jpe?g)$/i.test(url.pathname) ||
      privateHost ||
      /(^|\.)(example\.(com|org|net)|invalid|localhost|local|test)$/i.test(url.hostname))
    throw new Error('参考 URL 必须是在线图片直链（png/gif/webp/jpg/jpeg，可含签名 query），不能是网页、私有地址或占位符');
  return value; // Preserve signatures byte-for-byte; no reachability or image-content claim.
}

export function compileMidjourneyPrompt(compiled,target,profile,settings,negative) {
  const surface = target.surface ?? 'web';
  if (!['web','discord'].includes(surface)) throw new Error('Midjourney surface 只接受 web 或 discord');
  const warnings = [], blockers = [], manifest = [], bindings = target.references ?? [];
  if (!Array.isArray(bindings)) throw new Error('target.references 必须是参考角色数组');
  const inputs = new Map(compiled.reference_inputs.map(ref => [ref.id,ref]));
  const seen = new Set();
  for (const binding of bindings) {
    if (!object(binding) || Object.keys(binding).some(k=>!['reference_id','role','url','weight','attachment_confirmed'].includes(k)))
      throw new Error('MJ 参考只接受 reference_id、role、url、weight、attachment_confirmed');
    const {reference_id:id,role} = binding, ref = inputs.get(id), key = `${id}:${role}`;
    if (!ref || !['image','style','edit','omni'].includes(role) || seen.has(key)) throw new Error('MJ 参考缺失、角色未知或重复；只能绑定 generation_input: true 的参考');
    seen.add(key);
    if (role === 'edit' && !['8.1','8.2'].includes(profile.model)) throw new Error('edit 参考仅支持 V8.1/V8.2；V7 使用单图 omni');
    if (role === 'omni' && profile.model !== '7') throw new Error('omni 参考仅支持显式 V7；V8.X 使用 edit');
    if (binding.attachment_confirmed !== undefined && typeof binding.attachment_confirmed !== 'boolean') throw new Error('attachment_confirmed 必须是布尔值，仅记录用户已手动挂图的事实');
    if (binding.weight !== undefined && (surface !== 'discord' || role !== 'style' || typeof binding.weight !== 'number' || !Number.isFinite(binding.weight) || binding.weight <= 0))
      throw new Error('单图 weight 仅支持 Discord style 参考的有限正数，不是身份强度');
    const explicitUrl = binding.url !== undefined ? imageUrl(binding.url) : undefined;
    const sourceUrl = explicitUrl ?? (/^https?:/i.test(ref.source) ? imageUrl(ref.source) : null);
    const attachment = {image:'Image Prompt',style:'Style Reference',edit:'Attach to prompt',omni:'Omni Reference'}[role];
    const ready = surface === 'web' ? binding.attachment_confirmed === true : sourceUrl !== null;
    if (!ready) blockers.push(`${id}/${role}：${surface === 'web' ? `请手动上传或选择原图并放入 ${attachment}，确认后重新编译` : '缺少真实图片直链；请用户手动上传后提供 URL，不能伪造'}`);
    manifest.push({reference_id:id,role,source:ref.source,url:sourceUrl,web_attachment:attachment,
      ...(binding.weight !== undefined ? {weight:binding.weight} : {}),ready});
  }
  for (const [id] of inputs) {
    const assigned = manifest.filter(ref=>ref.reference_id===id);
    if (!assigned.length) throw new Error(`MJ 参考 ${id} 缺少明确平台角色，不能丢弃参考图`);
    const authority = compiled.audit?.reference_usage?.find(ref=>ref.id===id)?.authority ?? [];
    if (authority.includes('identity') && !assigned.some(ref=>['edit','omni'].includes(ref.role)))
      throw new Error(`身份参考 ${id} 必须用 edit 或 omni，style/image 不提供身份绑定`);
  }
  const refs = role=>manifest.filter(ref=>ref.role===role);
  if (refs('edit').length > 4) throw new Error('Edit Model 最多四张参考图');
  if (refs('omni').length > 1) throw new Error('V7 Omni Reference 只接受一张图');
  if (refs('edit').length && settings.tile) throw new Error('Edit Model 不兼容 tile');
  if (refs('omni').length && (settings.quality === 4 || settings.draft)) throw new Error('Omni Reference 不兼容 q 4 或 Draft');
  if (settings.omni_weight !== undefined && !refs('omni').length) throw new Error('omni_weight 需要 V7 omni 参考；不能作为 Edit 强度');
  if (settings.image_weight !== undefined && !refs('image').length) throw new Error('image_weight 需要 image 参考；不能作为 Edit 身份强度');
  const styles = settings.style_reference ?? [];
  if ((settings.style_weight !== undefined || settings.style_version !== undefined) && !refs('style').length && !styles.length)
    throw new Error('style_weight/style_version 需要 style 参考或显式 style_reference 代码；不控制 Moodboards');
  if (styles.length && settings.style_version !== undefined && ![4,6].includes(settings.style_version)) throw new Error('V7 style 代码/random 只支持 sv 4 或 6');
  if (settings.draft && ['8.1','8.2'].includes(profile.model)) {
    if (surface === 'discord') throw new Error('V8.1/V8.2 Draft 仅网页支持，Discord 不支持');
    warnings.push('Draft 专页与 Version 兼容表冲突：依专页仅允许网页；每条产生 24 张低分辨率图。默认不启用。');
  }
  if (settings.resolution === 'hd' && settings.aspect_ratio) {
    const [w,h] = settings.aspect_ratio.split(':').map(Number);
    if (Math.max(w/h,h/w) > 4) throw new Error('V8.X HD 比例上限为 4:1（含竖幅）');
  }
  if (settings.resolution === 'hd' && refs('edit').length && !settings.aspect_ratio)
    blockers.push('HD + Edit 未显式 ar：首图比例未知，请确认不超 4:1 或显式设置比例');
  if (refs('edit').length && !settings.aspect_ratio) warnings.push('Edit 未显式 ar：首张 edit 参考决定比例，不沿用默认画幅设置。');
  if (refs('omni').length) warnings.push('Omni 专页称目前不兼容 Fast Mode；请手动核对账号速度设置与兼容性，本适配器不设置速度。');
  if (manifest.length) warnings.push('参考引导不保证人物或细节完全一致；编译器未联网检查 URL 可达性、图像内容或完成挂图。');
  if (settings.exp > 0) warnings.push('exp 为实验美学参数，高值可能降低提示词遵循。');
  if (settings.personalization) warnings.push('请手动核对 Personalization 已解锁及所选 profile 与模型兼容；不推断或创建 profile。');
  if (negative !== undefined) warnings.push('--no 会逐词解释；逗号分隔明确对象，避免复合否定误伤目标。');
  const flags = [`--v ${profile.model}`];
  for (const [key,flag] of [['aspect_ratio','ar'],['seed','seed'],['stylize','stylize'],['chaos','chaos'],['weird','weird'],['quality','q'],['image_weight','iw'],['style_weight','sw'],['style_version','sv'],['omni_weight','ow'],['exp','exp']])
    if (settings[key] !== undefined) flags.push(`--${flag} ${settings[key]}`);
  if (settings.raw) flags.push('--raw');
  if (settings.resolution) flags.push(`--${settings.resolution}`);
  if (settings.tile) flags.push('--tile');
  if (settings.draft) flags.push('--draft');
  if (settings.personalization) flags.push(settings.personalization === true ? '--p' : `--p ${settings.personalization}`);
  if (surface === 'discord') for (const [role,flag] of [['edit','edit'],['omni','oref']]) {
    const urls = refs(role).filter(ref=>ref.url).map(ref=>ref.url);
    if (urls.length) flags.push(`--${flag} ${urls.join(' ')}`);
  }
  const styleUrls = surface === 'discord' ? refs('style').filter(ref=>ref.url).map(ref=>`${ref.url}${ref.weight !== undefined ? `::${ref.weight}` : ''}`) : [];
  if (styles.length || styleUrls.length) flags.push(`--sref ${[...styleUrls,...styles].join(' ')}`);
  if (negative !== undefined) flags.push(`--no ${negative}`);
  const parameter_suffix = flags.join(' ');
  const imagePrefix = surface === 'discord' ? refs('image').filter(ref=>ref.url).map(ref=>ref.url).join(' ') : '';
  const native_prompt = [imagePrefix,compiled.prompt].filter(Boolean).join('\n');
  const submission_text = `${native_prompt}\n${parameter_suffix}`;
  return {prompt:compiled.prompt,native_prompt,model:profile.model,surface,parameters:parameter_suffix,parameter_suffix,submission_text,
    reference_manifest:manifest,warnings,blockers,ready_to_submit:blockers.length === 0,
    manual_instructions:surface === 'web'
      ? '用户手动在网页 Imagine bar 粘贴 submission_text；按 reference_manifest 上传/选择原图并设置附件角色，确认当前界面设置后自行提交。'
      : '用户手动选择 Discord /imagine，将 submission_text 粘贴到 prompt 字段；/imagine 不是正文。核对 URL 可访问性和当前设置后自行提交。'};
}
