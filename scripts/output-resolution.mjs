export const outputResolution = Object.freeze({contract:'long_edge_4k_v1', minimum_long_edge:3840});

export function outputResolutionClause(language = 'zh-CN') {
  return language === 'en'
    ? '【Output resolution】\n4K pixel resolution. Preserve the current aspect ratio; the final image must have a long edge of at least 3840 pixels.'
    : '【输出分辨率】\n4K 像素分辨率，保持当前画幅比例，成图长边至少 3840 像素。';
}

// Merge into the authored output section without rewriting unrelated design prose.
export function resolveOutputSections(sections, language = 'zh-CN') {
  const next = structuredClone(sections);
  const [heading, text] = outputResolutionClause(language).split('\n');
  const matches = next.filter(section => ['输出分辨率', 'Output resolution'].includes(section.label));
  if (matches.length > 1) throw new Error('use one output resolution section');
  const section = matches[0];
  if (section) {
    if (section.channel !== 'output') throw new Error('output resolution section needs output channel');
    for (const item of section.items) {
      const dimensions = [...item.text.matchAll(/\b(\d+)\s*[x×]\s*(\d+)\b/gi)];
      if (dimensions.some(([,w,h]) => !Number.isSafeInteger(Number(w)) || !Number.isSafeInteger(Number(h)) || Math.max(Number(w),Number(h)) < 3840) || /\b(?:[12]K|720p|1080p)\b/i.test(item.text))
        throw new Error('output resolution conflicts with the mandatory 4K long edge of at least 3840 pixels');
    }
  }
  const alreadyAuthored = next.some(s => s.channel === 'output' && s.items.some(item => item.text.trim() === text));
  if (!alreadyAuthored) {
    const item = {text, generated:true};
    if (section) section.items.push(item);
    else next.push({label:heading.slice(1,-1), channel:'output', items:[item]});
  }
  return next;
}

export function planOutputResolution(settings, policy) {
  if (!policy) return undefined;
  const size = /^(\d+)x(\d+)$/.exec(settings.size ?? '');
  const width = settings.width ?? (size ? Number(size[1]) : undefined);
  const height = settings.height ?? (size ? Number(size[2]) : undefined);
  const preset = settings.image_size ?? settings.size;
  const required = width && height ? Math.max(width,height) < policy.minimum_long_edge
    : preset === '4K' ? false : ['1K','2K'].includes(preset) ? true : null;
  return {...policy, native_size:width && height ? {width,height} : preset === '4K' ? {preset} : null,
    upscale_required:required, steps:required === true ? ['generate','upscale','inspect_final_pixels']
      : required === false ? ['generate','inspect_final_pixels'] : ['generate','inspect_pixels_and_upscale_if_needed'],
    actual_pixels_verified:false};
}

// Encoded dimensions only; this does not judge content, sharpness or identity.
export function imageDimensions(bytes) {
  const valid = (width,height) => width > 0 && height > 0 ? {width,height} : null;
  if (bytes.length >= 24 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16)==='IHDR')
    return valid(bytes.readUInt32BE(16),bytes.readUInt32BE(20));
  if (bytes.length >= 10 && /^GIF8[79]a$/.test(bytes.toString('ascii',0,6)))
    return valid(bytes.readUInt16LE(6),bytes.readUInt16LE(8));
  if (bytes.length >= 16 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP') {
    for (let offset=12; offset+8<=bytes.length;) {
      const kind=bytes.toString('ascii',offset,offset+4), length=bytes.readUInt32LE(offset+4), data=offset+8;
      if (data+length>bytes.length) return null;
      if (kind==='VP8X' && length>=10) return valid(1+bytes.readUIntLE(data+4,3),1+bytes.readUIntLE(data+7,3));
      if (kind==='VP8L' && length>=5 && bytes[data]===0x2f) {
        const bits=bytes.readUInt32LE(data+1); return valid((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1);
      }
      if (kind==='VP8 ' && length>=10 && bytes.subarray(data+3,data+6).equals(Buffer.from([0x9d,1,0x2a])))
        return valid(bytes.readUInt16LE(data+6)&0x3fff,bytes.readUInt16LE(data+8)&0x3fff);
      offset=data+length+(length%2);
    }
  }
  if (bytes.length >= 4 && bytes[0]===0xff && bytes[1]===0xd8) {
    for (let offset=2; offset+4<=bytes.length;) {
      if (bytes[offset++]!==0xff) return null;
      while(bytes[offset]===0xff)offset++;
      const marker=bytes[offset++];
      if (marker===0xd9 || marker===0xda) return null;
      if (marker===0x01 || (marker>=0xd0 && marker<=0xd7)) continue;
      if(offset+2>bytes.length)return null;
      const length=bytes.readUInt16BE(offset);
      if(length<2 || offset+length>bytes.length)return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length>=7)
        return valid(bytes.readUInt16BE(offset+5),bytes.readUInt16BE(offset+3));
      offset+=length;
    }
  }
  return null;
}

export function reviewOutputResolution(bytes, policy) {
  const dimensions=imageDimensions(bytes);
  return {...policy, ...dimensions, verdict:dimensions ? Math.max(dimensions.width,dimensions.height)>=policy.minimum_long_edge ? 'pass' : 'fail' : 'not_assessable',
    evidence:dimensions ? `Encoded image dimensions: ${dimensions.width}x${dimensions.height}.` : 'Unsupported or incomplete image header; final pixel dimensions require inspection.'};
}
