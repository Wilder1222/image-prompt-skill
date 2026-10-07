import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Arithmetic over reviewer-declared image-space bounds, not a landmark detector.
// The crown is the SAME variable in body height and head height.
export function proportionBounds(input) {
  if (!input || !Number.isSafeInteger(input.image_height) || input.image_height < 2)
    throw new Error('image_height must be the original positive pixel height');
  for (const key of ['landmark_note','projection_note'])
    if (typeof input[key] !== 'string' || !input[key].trim()) throw new Error(`missing ${key}`);
  const read = (key, allowMissingMinimum=false) => {
    const a=input[key];
    if (!Array.isArray(a) || a.length!==2 || a.some((v,i)=>!(i===0&&allowMissingMinimum&&v===null)&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>input.image_height-1)) || (a[0]!==null&&a[0]>a[1]))
      throw new Error(`invalid ${key}: use ordered y-down pixel bounds`);
    return a;
  };
  const c=read('crown_y'), j=read('chin_y'), s=read('sole_y',true);
  if(c[1]>=j[0] || j[1]>=(s[0]??s[1])) throw new Error('endpoint bounds must remain ordered crown < chin < sole');
  const lower=s[0]===null?null:(s[0]-c[0])/(j[1]-c[0]);
  const upper=(s[1]-c[1])/(j[0]-c[1]);
  return {schema_version:1,status:'diagnostic_only',target_head_count:9,
    ratio_lower:lower,ratio_upper:upper,
    target_relation:upper<9||(lower!==null&&lower>9)?'excluded_by_declared_bounds':'not_excluded_by_declared_bounds',
    anatomical_measurement_verified:false,image_height_verified:false,acceptance_granted:false,
    observations:{image_height:input.image_height,crown_y:c,chin_y:j,sole_y:s,landmark_note:input.landmark_note,projection_note:input.projection_note},
    formulas:{lower:s[0]===null?null:'(sole_min - crown_min) / (chin_max - crown_min)',upper:'(sole_max - crown_max) / (chin_min - crown_max)'},
    note:'仅核算所声明端点的投影比例界；端点语义、姿态、透视和各肢段协调仍需人工核对。区间包含九或数值恰为九均不授予通过，未设置验收容差。'};
}

export function auditProportionObservation(input,baseDir=process.cwd()) {
  if(typeof input?.image!=='string'||!input.image.trim()||!/^[a-f0-9]{64}$/.test(input.image_sha256??''))throw new Error('image and recorded SHA-256 required');
  const image=path.resolve(baseDir,input.image);
  const sha=crypto.createHash('sha256').update(fs.readFileSync(image)).digest('hex');
  if(sha!==input.image_sha256)throw new Error('image SHA-256 mismatch');
  return {...proportionBounds(input),image,image_sha256:sha};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.length!==3)throw new Error('Usage: node scripts/proportion-observation.mjs observation.json');
    const source=path.resolve(process.argv[2]);
    console.log(JSON.stringify(auditProportionObservation(JSON.parse(fs.readFileSync(source,'utf8')),path.dirname(source)),null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
