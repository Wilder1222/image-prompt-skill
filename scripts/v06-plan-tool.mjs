#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIAG = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources/result_diagnostic_catalog.v06.json'),'utf8'));
const LOOK = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources/garment_look_matrix.template.json'),'utf8'));
const args = process.argv.slice(2);
const cmd = args[0];
const get = k => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i+1] : null;
};
const csv = v => (v||'').split(',').map(s=>s.trim()).filter(Boolean);
function diversityCheck(matrix){
  const looks = matrix.looks || [];
  const pairs = [];
  for(let i=0;i<looks.length;i++){
    for(let j=i+1;j<looks.length;j++){
      const a=looks[i], b=looks[j];
      const keys=['silhouette','neckline','shoulder_structure','waist_system','lower_structure','armor_ratio','transparency_budget','exposure_level'];
      const diff = keys.filter(k => a[k]!==b[k]);
      pairs.push({a:a.look_id,b:b.look_id,diff_count:diff.length,diff_keys:diff,pass:diff.length>=3});
    }
  }
  return {status:pairs.every(p=>p.pass)?'pass':'fail',pairs};
}
function diagnose(list){
  const failures = csv(list).map(id=>({id, ...(DIAG.failures[id]||{})})).filter(x=>x.severity);
  if(!failures.length) throw new Error('no valid failures');
  const rank={critical:4,high:3,medium:2,low:1};
  failures.sort((a,b)=>rank[b.severity]-rank[a.severity]);
  const repair=[...new Set(failures.flatMap(f=>f.repair))];
  const preserve=[...new Set(failures.flatMap(f=>f.preserve))];
  return {first_focus:failures[0].id,failures,repair,preserve};
}
if(cmd==='diversity-check'){
  const out = diversityCheck(LOOK);
  console.log(JSON.stringify(out,null,2));
}else if(cmd==='diagnose'){
  const out = diagnose(get('failures'));
  console.log(JSON.stringify(out,null,2));
}else if(cmd==='show-matrix'){
  console.log(JSON.stringify(LOOK,null,2));
}else{
  console.log(JSON.stringify({commands:['show-matrix','diversity-check','diagnose --failures failure1,failure2']},null,2));
}
