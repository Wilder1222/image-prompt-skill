import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promptHash} from './production-prompt.mjs';
import {verifyFrozenRun,finishProductionRun} from './production-run.mjs';

export const dimensions=['参考或描述遵循','面容与妆容美感','真实感与生命感','比例与体型','动作与解剖','服装构造与延展','材料与细节','构图与完整性','背景与布光','完成度与伪影'];
export const expectedCases=['青黛花卉','现代针织','黑金幻想','青橙古装','纯文本舞者','纯文本时装'];

export function summarizeScores(rows,{cases=expectedCases,finalRound=2}={}) {
  const outputs=new Set(),runs=new Set();
  const verified=rows.map(row=>{
    const s=row.score;
    if(!s?.运行||runs.has(s.运行))throw new Error('运行缺失或重复');
    if(!/^[a-f0-9]{64}$/.test(s.输出摘要??'')||outputs.has(s.输出摘要))throw new Error('输出摘要缺失或重复图片');
    outputs.add(s.输出摘要);runs.add(s.运行);
    if(s.查看状态!=='已查看完整图像'||s.逐项?.length!==dimensions.length)throw new Error('图像未完整评审');
    for(const [i,d] of s.逐项.entries()) {
      if(d.维度!==dimensions[i]||!Number.isFinite(d.分数)||d.分数<0||d.分数>10||!Number.isInteger(d.分数*2)||typeof d.证据!=='string'||!d.证据.trim())throw new Error('维度、分数或视觉证据不完整');
    }
    const raw=s.逐项.reduce((n,d)=>n+d.分数,0)/dimensions.length;
    if(s.关键失败封顶&&!s.封顶原因)throw new Error('关键失败缺少封顶原因');
    const average=s.关键失败封顶?Math.min(raw,6):raw;
    if(Math.abs(average-s.平均分)>1e-9)throw new Error('保存的均分不符合固定算法');
    if(!cases.includes(row.caseName)||!Number.isInteger(s.轮次)||s.轮次<1)throw new Error('未知案例或轮次');
    return {运行:s.运行,案例:row.caseName,轮次:s.轮次,平均分:average,视觉合格:row.qualified===true};
  });
  const final=verified.filter(r=>r.轮次===finalRound);
  if(new Set(final.map(r=>r.案例)).size!==final.length)throw new Error('最终轮同一案例存在重复，不能挑选候选计分');
  const missing=cases.filter(c=>!final.some(r=>r.案例===c));
  const mean=rs=>rs.length?rs.reduce((s,r)=>s+Math.round(r.平均分*20),0)/(20*rs.length):null;
  const allMean=mean(verified),finalMean=mean(final);
  return {已评审图数:verified.length,全部尝试平均分:allMean,最终轮图数:final.length,最终轮平均分:finalMean,最终轮缺少案例:missing,最终轮未合格:final.filter(r=>!r.视觉合格).map(r=>r.运行),视觉分数目标达成:missing.length===0&&final.length===cases.length&&final.every(r=>r.视觉合格)&&allMean>9&&finalMean>9,逐图:verified,说明:'仅统计实际查看并有输出摘要的本轮图像；不是用户验收或普遍成功率。中文化、项目一致性和发布条件需另行完成。'};
}

export function reportDirectory(dir){
  const read=f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8').replace(/^\uFEFF/,''));
  const snapshots=fs.readdirSync(dir).filter(f=>f.endsWith('.snapshot.json'));
  const rows=[],pending=[];
  for(const file of snapshots){
    const base=file.slice(0,-'.snapshot.json'.length),snapshot=read(file);
    verifyFrozenRun(snapshot);
    if(!fs.existsSync(path.join(dir,base+'.scores.json'))){pending.push(base);continue;}
    const score=read(base+'.scores.json'),receipt=read(base+'.receipt.json'),outcome=read(base+'.outcome.json');
    if(score.运行!==snapshot.run_id||score.提示词摘要!==snapshot.prompt_sha256||receipt.snapshot_sha256!==snapshot.snapshot_sha256||outcome.snapshot_sha256!==snapshot.snapshot_sha256)throw new Error('评分未绑定实际冻结运行');
    const hash=promptHash(fs.readFileSync(path.resolve(dir,receipt.output_image)));
    if(score.输出摘要!==hash||receipt.output_sha256!==hash||outcome.output_sha256!==hash)throw new Error('实际输出与评分摘要不同');
    if(finishProductionRun(snapshot,receipt,dir).status!==outcome.status)throw new Error('视觉结论与实际验收记录不同');
    rows.push({score,caseName:snapshot.case_id,qualified:outcome.status==='reviewer_qualified'});
  }
  const report=summarizeScores(rows);
  return {...report,未完成或未评审运行:pending,视觉分数目标达成:report.视觉分数目标达成&&pending.length===0};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{console.log(JSON.stringify(reportDirectory(path.resolve(process.argv[2]??'.')),null,2));}
  catch(e){console.error(e.message);process.exitCode=1;}
}
