import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dimensions,summarizeScores} from '../scripts/visual-score-report.mjs';
const row=(id,caseName='案例甲',round=2,points=9.5)=>({caseName,qualified:true,score:{运行:id,轮次:round,输出摘要:id.padEnd(64,'a'),提示词摘要:'b'.repeat(64),查看状态:'已查看完整图像',关键失败封顶:false,逐项:dimensions.map(维度=>({维度,分数:points,证据:'合成测试数据，不是图像评审。'})),平均分:points}});
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
