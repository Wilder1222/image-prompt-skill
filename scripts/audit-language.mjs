import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {releaseFiles} from './release-check.mjs';

export function englishProse(text){
  const stripped=text.replace(/https?:\/\/\S+/g,'').replace(/`[^`]+`/g,'').replace(/\]\([^)]+\)/g,']');
  return /\b[A-Za-z]{2,}(?:[ ,;:]+[A-Za-z]{2,}){3,}\b/.test(stripped)
    || /^#{1,6}\s+[A-Za-z][A-Za-z -]{2,}(?:\s+v?[\d.]+)?$/.test(stripped.trim());
}

export function inspectText(file,text){
  const rows=[];
  if(file.endsWith('.json')){
    const visit=(value,location)=>{
      if(typeof value==='string'&&englishProse(value))rows.push({文件:file,位置:location,内容:value});
      else if(Array.isArray(value))value.forEach((v,i)=>visit(v,`${location}[${i}]`));
      else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>visit(v,`${location}.${k}`));
    };visit(JSON.parse(text.replace(/^\uFEFF/,'')),'$');
  }else{
    let fenced=false,code=false;
    for(const [i,line] of text.split(/\r?\n/).entries()){
      if(/^\s*```/.test(line)){if(!fenced){code=/^\s*```(?:bash|sh|powershell|ps1|js|javascript|ts|typescript|python|json|yaml)\b/.test(line);fenced=true;}else{fenced=false;code=false;}continue;}
      if(!code&&englishProse(line))rows.push({文件:file,位置:`第${i+1}行`,内容:line.trim()});
    }
  }
  return rows;
}

export function auditLanguage(root){
  const findings=releaseFiles(root).filter(f=>/\.(md|json|ya?ml|txt)$/.test(f)&&!f.startsWith('scripts/')).flatMap(f=>inspectText(f,fs.readFileSync(path.join(root,f),'utf8')));
  return {待人工核对文件数:new Set(findings.map(f=>f.文件)).size,英文候选数:findings.length,说明:'这是英文自然语言候选扫描，命令和兼容标识保留；短词、混排和历史原始证据仍需人工审查。零候选不能单独证明全部中文化。',候选:findings};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(auditLanguage(path.resolve(process.argv[2]??'.')),null,2));
