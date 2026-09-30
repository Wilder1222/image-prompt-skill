import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {dimensions,summarizeScores,applyReviewNotes,reportDirectory} from '../scripts/visual-score-report.mjs';
import {freezeProductionRun,finishProductionRun} from '../scripts/production-run.mjs';
import {promptHash} from '../scripts/production-prompt.mjs';
const row=(id,caseName='案例甲',round=2,points=9.5)=>({caseName,qualified:true,score:{运行:id,轮次:round,输出摘要:id.padEnd(64,'a'),提示词摘要:'b'.repeat(64),查看状态:'已查看完整图像',关键失败封顶:false,逐项:dimensions.map(维度=>({维度,分数:points,证据:'合成测试数据，不是图像评审。'})),平均分:points}});

function auditFixture(){
 const r=row('a');r.snapshot={snapshot_sha256:'c'.repeat(64),target:{acceptance:[{id:'frame',critical:true}]}};r.receipt={checks:[{id:'frame',verdict:'pass',evidence:'原合成证据'}]};
 const note={运行:'a',检查:'frame',快照摘要:r.snapshot.snapshot_sha256,输出摘要:r.score.输出摘要,原结论:'pass',复核结论:'fail',理由:'合成测试：取景实际不通过',复核者:'合成评审者'};
 return {r,note};
}
test('a bound correction withdraws qualification without changing image scores or frozen receipt',()=>{
 const {r,note}=auditFixture(),before=JSON.stringify(r),rows=applyReviewNotes([r],[note]);
 const report=summarizeScores(rows,{cases:['案例甲']});
 assert.equal(report.全部尝试平均分,9.5);assert.equal(report.已评审图数,1);assert.equal(report.视觉分数目标达成,false);
 assert.equal(report.逐图[0].验收复核[0].关键项,true);assert.equal(JSON.stringify(r),before);
});
test('review corrections reject mismatched output, snapshot, check and favorable result changes',()=>{
 const {r,note}=auditFixture();
 for(const patch of [{运行:'b'},{输出摘要:'f'.repeat(64)},{快照摘要:'e'.repeat(64)},{检查:'missing'},{原结论:'fail'},{复核结论:'pass'},{理由:''},{复核者:''}])assert.throws(()=>applyReviewNotes([r],[{...note,...patch}]));
 assert.throws(()=>applyReviewNotes([r],[note,note]),/重复/);
});
test('noncritical corrections stay visible without withdrawing a qualified result',()=>{
 const {r,note}=auditFixture();r.snapshot.target.acceptance[0].critical=false;
 const rows=applyReviewNotes([r],[note]);assert.equal(rows[0].qualified,true);assert.equal(rows[0].reviewNotes.length,1);
 assert.equal(applyReviewNotes([r],[])[0].qualified,true);
});
test('directory report applies saved audit notes while preserving the original receipt and mean',t=>{
 const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'score-audit-'));
 t.after(()=>{if(path.dirname(path.resolve(dir))!==parent)throw new Error('unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true});});
 const input={request:'生成蓝色衣服测试。',references:[],requirements:[{id:'U1',channel:'costume',text:'蓝衣。',priority:'must'}],unresolved:[],sections:[{label:'服装',channel:'costume',items:[{text:'蓝色上衣。',basis:['U1'],intent:'constraint'}]}],acceptance:[{id:'cloth',basis:'U1',question:'蓝衣是否成立？',critical:true}]};
 const snapshot=freezeProductionRun(input,{run_id:'a',case_id:'案例甲',cohort:'synthetic'});
 const output=path.join(dir,'fixture.png');fs.writeFileSync(output,Buffer.from('synthetic-byte-binding-fixture'));
 const hash=promptHash(fs.readFileSync(output)),receipt={status:'completed',snapshot_sha256:snapshot.snapshot_sha256,target_sha256:snapshot.target_sha256,prompt_sha256:snapshot.prompt_sha256,output_image:output,output_sha256:hash,inspected:true,reviewer:'synthetic fixture',checks:[{id:'cloth',verdict:'pass',evidence:'合成通过证据'}]};
 const score=row('a').score;score.输出摘要=hash;score.提示词摘要=snapshot.prompt_sha256;
 const save=(name,value)=>fs.writeFileSync(path.join(dir,name),JSON.stringify(value));
 save('a.snapshot.json',snapshot);save('a.receipt.json',receipt);save('a.outcome.json',finishProductionRun(snapshot,receipt,dir));save('a.scores.json',score);
 assert.equal(reportDirectory(dir,{cases:['案例甲']}).视觉分数目标达成,true);
 save('review-notes.json',[{运行:'a',检查:'cloth',快照摘要:snapshot.snapshot_sha256,输出摘要:hash,原结论:'pass',复核结论:'uncertain',理由:'合成复核：颜色无法确定',复核者:'synthetic fixture'}]);
 const report=reportDirectory(dir,{cases:['案例甲']});assert.equal(report.视觉分数目标达成,false);assert.equal(report.全部尝试平均分,9.5);assert.equal(report.验收复核注记数,1);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'a.receipt.json'),'utf8')).checks[0].verdict,'pass');
});
test('a high mean cannot pass an incomplete final cohort',()=>{const r=summarizeScores([row('a')],{cases:['案例甲','案例乙']});assert.equal(r.视觉分数目标达成,false);assert.deepEqual(r.最终轮缺少案例,['案例乙']);});
test('9.45 cannot be rounded into the 9.5 target',()=>{const a=row('a');a.score.逐项[0].分数=9;a.score.平均分=9.45;const r=summarizeScores([a],{cases:['案例甲']});assert.equal(r.全部尝试平均分,9.45);assert.equal(r.目标最低平均分,9.5);assert.equal(r.视觉分数目标达成,false);});
test('all attempts remain in the mean rather than selecting only the final image',()=>{const r=summarizeScores([row('a','案例甲',1,7),row('b')],{cases:['案例甲']});assert.equal(r.全部尝试平均分,8.25);assert.equal(r.视觉分数目标达成,false);});
test('duplicated image and missing evidence cannot manufacture a score',()=>{const a=row('a'),b=row('b');b.score.输出摘要=a.score.输出摘要;assert.throws(()=>summarizeScores([a,b],{cases:['案例甲']}),/重复图片/);a.score.逐项[0].证据='';assert.throws(()=>summarizeScores([a],{cases:['案例甲']}),/证据/);});
test('critical failures are capped and numerical success cannot override visual failure',()=>{const a=row('a');a.score.关键失败封顶=true;a.score.封顶原因='合成的严重解剖错误';assert.throws(()=>summarizeScores([a],{cases:['案例甲']}),/均分/);a.score.平均分=6;assert.equal(summarizeScores([a],{cases:['案例甲']}).全部尝试平均分,6);const b=row('b');b.qualified=false;assert.equal(summarizeScores([b],{cases:['案例甲']}).视觉分数目标达成,false);});
test('complete qualified final cohort and all attempts at 9.5 meet only the visual gate',()=>{const r=summarizeScores([row('a'),row('b','案例乙')],{cases:['案例甲','案例乙']});assert.equal(r.视觉分数目标达成,true);});
test('a final 9.5 does not erase earlier below-target attempts',()=>{const r=summarizeScores([row('a','案例甲',1,9),row('b')],{cases:['案例甲']});assert.equal(r.全部尝试平均分,9.25);assert.equal(r.最终轮平均分,9.5);assert.equal(r.视觉分数目标达成,false);});

test('an explicitly selected later complete round keeps earlier edits in the denominator',()=>{
  const rows=[row('a','案例甲',2,9),row('b','案例甲',3,9),row('c','案例乙',4,9),row('d','案例甲',5,10),row('e','案例乙',5,10)];
  const r=summarizeScores(rows,{cases:['案例甲','案例乙'],finalRound:5});
  assert.equal(r.最终轮图数,2);assert.equal(r.最终轮平均分,10);assert.equal(r.全部尝试平均分,9.4);assert.equal(r.视觉分数目标达成,false);
  assert.throws(()=>summarizeScores(rows,{finalRound:0}),/正整数/);
  assert.throws(()=>summarizeScores(rows,{finalRound:NaN}),/正整数/);
});
