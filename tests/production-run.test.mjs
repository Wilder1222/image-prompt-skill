import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compileProductionPrompt,reviseProductionInput,promptHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun,finishProductionRun,summarizeProductionRuns,writeNew,objectHash} from '../scripts/production-run.mjs';

function setup(t){
 const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'image-prompt-run-'));
 t.after(()=>{if(path.dirname(path.resolve(dir))!==parent)throw new Error('unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true});});
 const ref=path.join(dir,'ref.png');fs.writeFileSync(ref,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'));
 const input={request:'保持参考人物，白底，蓝色衣服。',references:[{id:'R1',source:ref,inspected:true,generation_input:true,authority:['identity','costume'],facts:[{id:'F1',channel:'identity',visibility:'visible',text:'柔和下颌。'}]}],requirements:[{id:'U1',channel:'identity',priority:'must',text:'原人物。'},{id:'U2',channel:'costume',priority:'must',text:'蓝衣。'}],unresolved:[],sections:[{label:'人物',channel:'identity',items:[{text:'保留参考人物的柔和下颌。',basis:['F1','U1'],intent:'retain'}]},{label:'衣服',channel:'costume',items:[{text:'穿蓝色衣服。',basis:['U2'],intent:'constraint'}]}],acceptance:[{id:'face',basis:'U1',critical:true,question:'原人物？'},{id:'cloth',basis:'U2',critical:true,question:'蓝衣？'}]};
 input.subject_kind='character';
 input.requirements.push({id:'P9',channel:'proportion',priority:'must',target_head_count:9,text:'黄金九头身，排除发量与鞋跟。'});
 input.sections.push({label:'比例',channel:'proportion',items:[{text:'黄金九头身，人体直立高度为九个颅顶至下巴头长，排除发量与鞋跟，各段协调。',basis:['P9'],intent:'constraint'}]});
 input.acceptance.push({id:'proportion',basis:'P9',critical:true,question:'九头身与各段协调是否成立？'});
 return {dir,ref,input};
}
const freeze=(input,extra={})=>freezeProductionRun(input,{run_id:'a',case_id:'case',cohort:'test',...extra});

test('freezing refuses unsupported reference controls before declaring a dispatchable run',t=>{
 const {input}=setup(t);
 input.references[0].subject_scale=0.9;
 assert.throws(()=>freeze(input),/unsupported reference field subject_scale/);
 delete input.references[0].subject_scale;
 const snapshot=freeze(input),args=verifyFrozenRun(snapshot);
 assert.deepEqual(Object.keys(args).sort(),['prompt','referenced_image_paths']);
 assert.deepEqual(args.referenced_image_paths,[input.references[0].source]);
});
function withLayout(t){
 const context=setup(t),{input,ref}=context;
 input.references.push({id:'SHEET',source:ref,inspected:true,generation_input:true,authority:['layout'],facts:[{id:'grid',channel:'layout',visibility:'visible',text:'Synthetic panel layout only, not a character reference.'}]});
 input.requirements.push({id:'sheet',channel:'layout',priority:'must',text:'横向三格，共同尺度。'});
 input.sections.push({label:'版式',channel:'layout',items:[{text:'横向三格，共同尺度。',intent:'retain',basis:['grid','sheet']}]});
 input.acceptance.push({id:'sheet-check',basis:'sheet',critical:true,question:'三格版式是否成立？'});
 return context;
}

test('layout references preserve input order without acquiring character or camera authority',t=>{
 const {input}=withLayout(t),s=freeze(input);
 assert.deepEqual(s.actual_inputs.map(r=>r.id),['R1','SHEET']);
 assert.equal(verifyFrozenRun(s).referenced_image_paths.length,2);
 for(const channel of ['identity','costume','composition','proportion','style']){
  const bad=structuredClone(input);
  bad.sections.push({label:'越权用途',channel,items:[{text:'错误借用版式图控制其他属性。',intent:'retain',basis:['grid']}]});
  assert.throws(()=>compileProductionPrompt(bad),new RegExp('SHEET cannot control '+channel));
 }
});

test('layout-only revision cannot change view or nine-head requirements',t=>{
 const {input}=withLayout(t);
 input.requirements.push({id:'view',channel:'composition',priority:'must',text:'人物正面站立。'});
 input.sections.push({label:'视角',channel:'composition',items:[{text:'人物正面站立。',basis:['view'],intent:'constraint'}]});
 input.acceptance.push({id:'view-check',basis:'view',critical:true,question:'人物是否正面站立？'});
 const parent=freeze(input);
 const change={request:'只调整三格的间隔。',channels:['layout'],sections:[{label:'版式',items:[{text:'保留横向三格和共同尺度，将格间距加宽。',intent:'retain',basis:['grid','sheet']}]}]};
 const revised=reviseProductionInput(input,change);
 assert.deepEqual(revised.input.sections.filter(s=>s.channel!=='layout'),input.sections.filter(s=>s.channel!=='layout'));
 assert.deepEqual(revised.input.requirements,input.requirements);
 const next=freeze(revised.input,{run_id:'layout-revision',kind:'revision',parent});
 assert.equal(next.target_sha256,parent.target_sha256);assert.equal(next.goal_changed,false);
 assert.notEqual(next.prompt_sha256,parent.prompt_sha256);
 assert.throws(()=>reviseProductionInput(input,{...change,sections:[...change.sections,{label:'视角',items:[{text:'转为侧面。',basis:['view'],intent:'constraint'}]}]}),/escaped allowed scope/);
 assert.throws(()=>reviseProductionInput(input,{...change,requirements:[{...input.requirements.find(r=>r.id==='P9'),target_head_count:8}]}),/escaped allowed scope/);
});

test('sheet layout success cannot override failed character proportion',t=>{
 const {input,ref}=withLayout(t),s=freeze(input);
 const r={status:'completed',snapshot_sha256:s.snapshot_sha256,target_sha256:s.target_sha256,prompt_sha256:s.prompt_sha256,output_image:ref,output_sha256:promptHash(fs.readFileSync(ref)),inspected:true,reviewer:'synthetic fixture',checks:s.target.acceptance.map(c=>({id:c.id,verdict:c.id==='proportion'?'fail':'pass',evidence:'Synthetic decision test; not visual evidence.'}))};
 const result=finishProductionRun(s,r);
 assert.equal(result.status,'needs_revision');assert.deepEqual(result.critical_failures,['proportion']);
});
const preservationChecks=s=>s.edit_scope.preserve.map((_,index)=>({index,verdict:'pass',evidence:'Synthetic preserved item; not visual evidence.'}));
function outcome(s,ref,verdict='pass'){return finishProductionRun(s,{status:'completed',snapshot_sha256:s.snapshot_sha256,target_sha256:s.target_sha256,prompt_sha256:s.prompt_sha256,output_image:ref,output_sha256:promptHash(fs.readFileSync(ref)),inspected:true,reviewer:'synthetic test',checks:s.target.acceptance.map(c=>({id:c.id,verdict,evidence:'Synthetic fixture; not visual approval.'})),...(s.edit_scope?{scope_review:{verdict:'pass',change_evidence:'Synthetic changed area.',preservation_evidence:'Synthetic unchanged area.',...(s.scope_review_contract?{preservation_checks:preservationChecks(s)}:{})}}:{})});}

test('local edits retain the hard proportion target and cannot downgrade it through revision',t=>{
 const {input,ref}=setup(t),parent=freeze(input);
 const result=reviseProductionInput(input,{request:'只改变衣服颜色。',channels:['costume'],sections:[{label:'衣服',items:[{text:'蓝色布料略偏深，其他部分保持。',basis:['U2'],intent:'constraint'}]}]});
 assert.deepEqual(result.input.requirements.find(r=>r.id==='P9'),input.requirements.find(r=>r.id==='P9'));
 assert.deepEqual(result.input.sections.find(s=>s.channel==='proportion'),input.sections.find(s=>s.channel==='proportion'));
 result.input.edit_scope={baseline_reference_id:'R1',changes:['仅衣服颜色'],preserve:['身份、比例与构图']};
 const s=freeze(result.input,{run_id:'b',parent,kind:'edit'});
 assert.equal(s.goal_changed,false);assert.equal(s.target.subject_kind,'character');
 const reviewed=outcome(s,ref,'not_assessable');assert.equal(reviewed.status,'needs_review');
 for(const update of [{...input.requirements.at(-1),target_head_count:0},{...input.requirements.at(-1),priority:'prefer'}]){
  assert.throws(()=>reviseProductionInput(input,{request:'比例修改。',channels:['proportion'],sections:[{label:'比例',items:input.sections.at(-1).items}],requirements:[update]}),/target_head_count|must proportion/);
 }
});

test('new edits bind a real baseline and visible scope without rewriting the goal',t=>{
 const {input}=setup(t),parent=freeze(input),scope={baseline_reference_id:'R1',changes:['头部尺寸和必要连接。'],preserve:['肩部以下与原标尺','衣服上的文字“完成。”与数字“1.5”']};
 assert.throws(()=>freeze(input,{kind:'edit',parent}),/require edit_scope/);
 const brief={...input,edit_scope:scope};
 assert.throws(()=>freeze(brief),/needs an edit or revision/);
 for(const bad of [{...scope,baseline_reference_id:'missing'},{...scope,changes:[]},{...scope,preserve:['']},{...scope,unexpected:true}])
  assert.throws(()=>freeze({...input,edit_scope:bad},{kind:'edit',parent}),/edit_scope requires/);
 const reviewOnly=structuredClone(brief);reviewOnly.references.push({...reviewOnly.references[0],id:'judge',authority:['composition'],generation_input:false,facts:[{id:'judge-fact',channel:'composition',visibility:'visible',text:'仅评价参考。'}]});reviewOnly.edit_scope.baseline_reference_id='judge';
 assert.throws(()=>freeze(reviewOnly,{kind:'edit',parent}),/actual input/);
 for(const text of ['style_workflow = anime_3d_character','【另一段】','P9_FASHION_ASSET'])
  assert.throws(()=>freeze({...input,edit_scope:{...scope,changes:[text]}},{kind:'edit',parent}),/internal|unfinished|mode/);
 const s=freeze(brief,{run_id:'edit',kind:'edit',parent});
 assert.equal(s.target_sha256,parent.target_sha256);assert.equal(s.goal_changed,false);
 assert.match(verifyFrozenRun(s).prompt,/【本次编辑范围】\n允许修改：\n- 头部尺寸和必要连接。\n\n必须保持：\n- 肩部以下与原标尺\n- 衣服上的文字“完成。”与数字“1.5”/);
 assert.deepEqual(s.edit_scope,scope);
 scope.preserve[0]='changed after freezing';assert.equal(s.edit_scope.preserve[0],'肩部以下与原标尺');
 const tampered=structuredClone(s);tampered.edit_scope.preserve=[];assert.throws(()=>verifyFrozenRun(tampered),/snapshot changed/);
});

test('out-of-scope changes prevent qualification even when target criteria pass',t=>{
 const {input,ref}=setup(t),parent=freeze(input),s=freeze({...input,edit_scope:{baseline_reference_id:'R1',changes:['只修头部'],preserve:['衣服领口和肩部']}},{run_id:'edit',kind:'edit',parent});
 const receipt={status:'completed',snapshot_sha256:s.snapshot_sha256,target_sha256:s.target_sha256,prompt_sha256:s.prompt_sha256,output_image:ref,output_sha256:promptHash(fs.readFileSync(ref)),inspected:true,reviewer:'synthetic test',checks:s.target.acceptance.map(c=>({id:c.id,verdict:'pass',evidence:'Synthetic target check.'}))};
 assert.throws(()=>finishProductionRun(s,receipt),/needs scope_review/);
 assert.throws(()=>finishProductionRun(s,{...receipt,scope_review:{verdict:'pass',change_evidence:'head changed',preservation_evidence:''}}),/preservation_evidence/);
 const scope={change_evidence:'Synthetic head correction.',preservation_evidence:'Synthetic collar moved outside allowed area.',preservation_checks:preservationChecks(s)};
 const failed=finishProductionRun(s,{...receipt,scope_review:{...scope,verdict:'fail'}});
 assert.equal(failed.status,'needs_revision');assert.deepEqual(failed.critical_failures,['__edit_scope__']);assert.equal(failed.user_accepted,false);
 for(const verdict of ['uncertain','not_assessable']){
  const pending=finishProductionRun(s,{...receipt,scope_review:{...scope,verdict}});
  assert.equal(pending.status,'needs_review');assert.ok(pending.unresolved.includes('__edit_scope__'));
 }
 const scopePass={verdict:'pass',change_evidence:'Synthetic changed region.',preservation_evidence:'Synthetic preserved region.',preservation_checks:preservationChecks(s)};
 assert.equal(finishProductionRun(s,{...receipt,scope_review:scopePass}).status,'reviewer_qualified');
 receipt.checks.find(c=>c.id==='proportion').verdict='fail';
 assert.equal(finishProductionRun(s,{...receipt,scope_review:scopePass}).status,'needs_revision');
 assert.equal(finishProductionRun(s,{status:'tool_error',snapshot_sha256:s.snapshot_sha256,error:'synthetic failure'}).status,'tool_error');
});

test('new scoped edits require complete indexed observations for every protected item',t=>{
 const {input,ref}=setup(t),parent=freeze(input);
 const s=freeze({...input,edit_scope:{baseline_reference_id:'R1',changes:['衣服表面笔触'],preserve:['人物身份和身体轮廓','暖白纸面及其细纹','服装结构与接缝']}},{run_id:'item-edit',kind:'edit',parent});
 const receipt={status:'completed',snapshot_sha256:s.snapshot_sha256,target_sha256:s.target_sha256,prompt_sha256:s.prompt_sha256,output_image:ref,output_sha256:promptHash(fs.readFileSync(ref)),inspected:true,reviewer:'synthetic fixture',checks:s.target.acceptance.map(c=>({id:c.id,verdict:'pass',evidence:'Synthetic target check.'})),scope_review:{verdict:'pass',change_evidence:'Synthetic brushwork change.',preservation_evidence:'Synthetic summary does not replace individual checks.'}};
 assert.throws(()=>finishProductionRun(s,receipt),/preservation_checks/);
 assert.equal(s.scope_review_contract,'preservation_items_v1');
 const checks=preservationChecks(s);
 for(const invalid of [[],checks.slice(1),[checks[0],checks[0],checks[2]],checks.map((c,i)=>i===1?{...c,index:3}:c),checks.map((c,i)=>i===1?{...c,index:1.5}:c),checks.map((c,i)=>i===1?{...c,evidence:' '}:c),checks.map((c,i)=>i===1?{...c,verdict:'approved'}:c)]){
  assert.throws(()=>finishProductionRun(s,{...receipt,scope_review:{...receipt.scope_review,preservation_checks:invalid}}),/preservation_checks/);
 }
 for(const verdict of ['pass','fail','uncertain','not_assessable']){
  const items=checks.map((c,i)=>i===1?{...c,verdict,evidence:'Synthetic paper texture comparison.'}:c).reverse();
  const result=finishProductionRun(s,{...receipt,scope_review:{...receipt.scope_review,preservation_checks:items}});
  assert.equal(result.status,verdict==='pass'?'reviewer_qualified':verdict==='fail'?'needs_revision':'needs_review');
  assert.equal(result.scope_review.declared_verdict,'pass');
  assert.equal(result.scope_review.verdict,verdict);
  assert.deepEqual(result.scope_review.preservation_checks.map(c=>c.requirement),s.edit_scope.preserve);
  assert.equal(result.scope_review.preservation_checks[1].evidence,'Synthetic paper texture comparison.');
 }
 const fullPass=finishProductionRun(s,{...receipt,scope_review:{...receipt.scope_review,verdict:'fail',preservation_checks:checks}});
 assert.equal(fullPass.status,'needs_revision','item checks must not erase another observed scope violation');
 const corrupted=structuredClone(s);corrupted.scope_review_contract='future_unknown';
 const {snapshot_sha256,...body}=corrupted;corrupted.snapshot_sha256=objectHash(body);
 assert.throws(()=>verifyFrozenRun(corrupted),/scope review contract/);
});

test('historical aggregate scope reviews stay readable without fabricated per-item approval',t=>{
 const {input,ref}=setup(t),parent=freeze(input);
 const legacy=freeze({...input,edit_scope:{baseline_reference_id:'R1',changes:['表面'],preserve:['人物','背景']}},{run_id:'old-scope',kind:'edit',parent});
 delete legacy.scope_review_contract;
 const {snapshot_sha256,...body}=legacy;legacy.snapshot_sha256=objectHash(body);
 const before=structuredClone(legacy),review=outcome(legacy,ref);
 assert.equal(review.status,'reviewer_qualified');
 assert.equal(review.scope_review.preservation_checks,undefined);
 assert.deepEqual(legacy,before);
 const receipt={status:'completed',snapshot_sha256:legacy.snapshot_sha256,target_sha256:legacy.target_sha256,prompt_sha256:legacy.prompt_sha256,output_image:ref,output_sha256:promptHash(fs.readFileSync(ref)),inspected:true,reviewer:'synthetic fixture',checks:legacy.target.acceptance.map(c=>({id:c.id,verdict:'pass',evidence:'Synthetic.'})),scope_review:{verdict:'pass',change_evidence:'Synthetic.',preservation_evidence:'Synthetic.',preservation_checks:preservationChecks(legacy)}};
 assert.throws(()=>finishProductionRun(legacy,receipt),/contract was not frozen/);
});

test('legacy edit snapshots do not gain a retrospective scope approval',t=>{
 const {input,ref}=setup(t),parent=freeze(input);
 const legacy={...parent,run_id:'legacy-edit',kind:'edit',parent:{run_id:parent.run_id,snapshot_sha256:parent.snapshot_sha256}};
 const {snapshot_sha256,...body}=legacy;legacy.snapshot_sha256=objectHash(body);
 assert.equal(verifyFrozenRun(legacy).prompt,parent.prompt);
 const review=outcome(legacy,ref);assert.equal(review.scope_review,undefined);assert.equal(legacy.edit_scope,undefined);
 const receipt={status:'completed',snapshot_sha256:legacy.snapshot_sha256,target_sha256:legacy.target_sha256,prompt_sha256:legacy.prompt_sha256,output_image:ref,output_sha256:promptHash(fs.readFileSync(ref)),inspected:true,reviewer:'synthetic test',checks:legacy.target.acceptance.map(c=>({id:c.id,verdict:'pass',evidence:'Synthetic.'})),scope_review:{verdict:'pass',change_evidence:'x',preservation_evidence:'y'}};
 assert.throws(()=>finishProductionRun(legacy,receipt),/unfrozen edit scope/);
});

test('scoped prompt revisions must refresh the operation boundary',t=>{
 const {input}=setup(t);input.edit_scope={baseline_reference_id:'R1',changes:['衣服色泽'],preserve:['身份与比例']};
 const change={request:'再修衣料。',channels:['costume'],sections:[{label:'衣服',items:[{text:'保持蓝衣，仅理顺主褶。',basis:['U2'],intent:'constraint'}]}]};
 assert.throws(()=>reviseProductionInput(input,change),/refresh edit_scope/);
 change.edit_scope={baseline_reference_id:'R1',changes:['衣料主褶'],preserve:['衣片边界、身份与比例']};
 const revised=reviseProductionInput(input,change);assert.match(revised.compiled.prompt,/允许修改：\n- 衣料主褶/);assert.equal(revised.target_changed,false);
});

test('legacy frozen targets remain inspectable without acquiring new nine-head approval',t=>{
 const {input,ref}=setup(t),current=freeze(input);
 // Construct the historical schema shape; this is synthetic compatibility evidence.
 const old=structuredClone(current);delete old.target.subject_kind;
 old.target.requirements=old.target.requirements.filter(r=>r.id!=='P9');
 old.target.acceptance=old.target.acceptance.filter(r=>r.basis!=='P9');
 old.prompt=input.sections.filter(s=>s.channel!=='proportion').map(s=>`【${s.label}】\n${s.items.map(i=>i.text).join('\n')}`).join('\n\n');
 old.prompt_sha256=promptHash(old.prompt);old.target_sha256=objectHash(old.target);
 const {snapshot_sha256,...body}=old;old.snapshot_sha256=objectHash(body);
 assert.equal(verifyFrozenRun(old).prompt,old.prompt);
 assert.equal(outcome(old,ref).checks.some(c=>c.basis==='P9'),false);
 const bytes=JSON.stringify(old);
 const successor=freeze(input,{run_id:'new-target',parent:old,kind:'revision'});
 assert.equal(successor.goal_changed,true);assert.equal(JSON.stringify(old),bytes);
 assert.equal(successor.target.subject_kind,'character');
});

test('frozen tool arguments preserve exact text and actual input order, without evaluation references',t=>{
 const {input}=setup(t),primary=input.references[0];
 input.references.unshift({...structuredClone(primary),id:'judge',generation_input:false,authority:['costume'],facts:[{id:'F2',channel:'costume',visibility:'visible',text:'合成服装观察。'}]});
 input.sections[1].items.push({text:'衣料低光泽。',basis:['F2'],intent:'retain'});
 const compiled=compileProductionPrompt(input),s=freeze(input),args=verifyFrozenRun(s);
 assert.equal(args.prompt,compiled.prompt);assert.deepEqual(args.referenced_image_paths,[primary.source]);
 assert.deepEqual(compiled.audit.reference_usage.map(r=>[r.id,r.input_position]),[['judge',null],['R1',1]]);
 assert.deepEqual(s.actual_inputs.map(r=>r.id),['R1']);
 assert.deepEqual(Object.keys(args).sort(),['prompt','referenced_image_paths']);
 assert.equal(s.references.length,2);assert.equal(s.tool_parameters.seed,null);
});
test('freezing blocks silent snapshot edits, reference replacement and output substitution',t=>{
 const {input,ref}=setup(t),s=freeze(input);const tampered=structuredClone(s);tampered.target.acceptance[0].critical=false;
 assert.throws(()=>verifyFrozenRun(tampered),/snapshot changed/);
 const o=outcome(s,ref);assert.equal(o.user_accepted,false);assert.ok(o.output_sha256);
 fs.appendFileSync(ref,'different bytes');assert.throws(()=>verifyFrozenRun(s),/reference content changed/);
});
test('review binds both original target and snapshot before visual qualification',t=>{
 const {input,ref}=setup(t),s=freeze(input);
 const r={status:'completed',snapshot_sha256:s.snapshot_sha256,target_sha256:'b'.repeat(64),prompt_sha256:s.prompt_sha256,output_image:ref,output_sha256:promptHash(fs.readFileSync(ref)),inspected:true,reviewer:'test',checks:[]};
 assert.throws(()=>finishProductionRun(s,r),/review target changed/);
 r.snapshot_sha256='a'.repeat(64);assert.throws(()=>finishProductionRun(s,r),/bind the frozen/);
});
test('same identity supporting views need one declared primary and cannot mix identity groups',t=>{
 const {input}=setup(t);Object.assign(input.references[0],{identity_group:'subject',identity_role:'primary'});
 input.references.push({...structuredClone(input.references[0]),id:'R2',identity_role:'support',facts:[{id:'F2',channel:'identity',visibility:'partial',text:'侧面下颌。'}]});
 input.sections[0].items[0].basis.push('F2');assert.doesNotThrow(()=>compileProductionPrompt(input));
 input.references[1].identity_group='other';assert.throws(()=>compileProductionPrompt(input),/conflicting identity/);
 input.references[1].identity_group='subject';input.references[0].identity_role='support';assert.throws(()=>compileProductionPrompt(input),/primary/);
});
test('tag edits preserve other sections and disallow changing an unapproved category',t=>{
 const {input}=setup(t),change={request:'衣服改红色。',channels:['costume'],sections:[{label:'衣服',items:[{text:'红色衣服。',intent:'constraint',basis:['U2']}]}],requirements:[{...input.requirements[1],text:'红衣。'}],acceptance:[{...input.acceptance[1],question:'红衣？'}]};
 const updated=reviseProductionInput(input,change);assert.deepEqual(updated.input.sections[0],input.sections[0]);assert.equal(input.sections[1].items[0].text,'穿蓝色衣服。');assert.equal(updated.target_changed,true);
 change.sections[0].label='人物';assert.throws(()=>reviseProductionInput(input,change),/escaped allowed scope/);
});
test('revision goal classification agrees with frozen targets when object fields are reordered',t=>{
 const {input}=setup(t),before=structuredClone(input),parent=freeze(input);
 const reorder=row=>Object.fromEntries(Object.entries(row).reverse());
 const change={request:'整理衣装字段，目标保持。',channels:['costume'],sections:[{label:'衣服',items:input.sections.find(s=>s.label==='衣服').items}],
  requirements:[reorder(input.requirements.find(r=>r.id==='U2'))],acceptance:[reorder(input.acceptance.find(c=>c.id==='cloth'))]};
 const revised=reviseProductionInput(input,change);
 const child=freeze(revised.input,{run_id:'reordered',kind:'revision',parent});
 assert.equal(revised.target_changed,false);
 assert.equal(child.goal_changed,revised.target_changed);
 assert.equal(child.target_sha256,parent.target_sha256);
 assert.equal(child.prompt_sha256,parent.prompt_sha256);
 assert.deepEqual(input,before);
 change.acceptance[0].question='衣服改为深蓝了吗？';
 const changed=reviseProductionInput(input,change);
 assert.equal(changed.target_changed,true);
 assert.equal(freeze(changed.input,{run_id:'changed',kind:'revision',parent}).goal_changed,true);
 // Object key order is incidental; ordered contract arrays remain significant.
 assert.notEqual(objectHash(input.requirements),objectHash([...input.requirements].reverse()));
});

test('changed goals cannot be counted as successful repair of the original target',t=>{
 const {input,ref}=setup(t),a=freeze(input);const output2=path.join(path.dirname(ref),'new.png');fs.writeFileSync(output2,Buffer.concat([fs.readFileSync(ref),Buffer.from('distinct test bytes')]));
 const revised=structuredClone(input);revised.acceptance[0].question='a relaxed different target';const b=freeze(revised,{run_id:'b',kind:'revision',parent:a});assert.equal(b.goal_changed,true);
 const summary=summarizeProductionRuns([{snapshot:a,outcome:outcome(a,ref,'fail')},{snapshot:b,outcome:outcome(b,output2)}]).cohorts.test;
 assert.equal(summary.initial_passed,0);assert.equal(summary.resolved_without_goal_change,0);assert.equal(summary.goal_changes,1);
});
test('reports separate repeated outputs, tool errors and pending work from successes',t=>{
 const {input,ref}=setup(t),a=freeze(input),b=freeze(input,{run_id:'b'}),c=freeze(input,{run_id:'c'}),d=freeze(input,{run_id:'d'});
 const error=finishProductionRun(c,{status:'tool_error',snapshot_sha256:c.snapshot_sha256,error:'test tool unavailable'});
 const rows=[{snapshot:a,outcome:outcome(a,ref)},{snapshot:b,outcome:outcome(b,ref)},{snapshot:c,outcome:error},{snapshot:d}];
 const s=summarizeProductionRuns(rows).cohorts.test;assert.equal(s.initial_completed,1);assert.equal(s.initial_passed,1);assert.equal(s.reused_outputs,1);assert.equal(s.tool_errors,1);assert.equal(s.pending,1);
 assert.throws(()=>summarizeProductionRuns([...rows,rows[0]]),/duplicate run/);
});

test('interrupted queues keep unknown dispatch separate from known tool failures or success',t=>{
 const {input}=setup(t),s=freeze(input),r={status:'interrupted',snapshot_sha256:s.snapshot_sha256,reason:'User changed the pose goal while a queue was active.',dispatch_state:'unknown'};
 const o=finishProductionRun(s,r),summary=summarizeProductionRuns([{snapshot:s,outcome:o}]).cohorts.test;
 assert.equal(summary.interrupted,1);assert.equal(summary.dispatch_unknown,1);assert.equal(summary.known_tool_calls,0);assert.equal(summary.tool_errors,0);assert.equal(summary.initial_completed,0);
 assert.throws(()=>finishProductionRun(s,{...r,output_image:'invented.png'}),/no claimed output/);
 assert.throws(()=>finishProductionRun(s,{...r,dispatch_state:'guessed'}),/dispatch state/);
});

test('pose and shoe-visibility changes update linked targets without changing identity or style',t=>{
 const {input}=setup(t);
 input.requirements.push({id:'pose',channel:'composition',priority:'must',text:'正面并立。'},{id:'feet',channel:'hands_feet',priority:'must',text:'展示双鞋。'});
 input.sections.push({label:'姿态',channel:'composition',items:[{text:'正面并立。',basis:['pose'],intent:'constraint'}]},{label:'脚部',channel:'hands_feet',items:[{text:'展示双鞋。',basis:['feet'],intent:'constraint'}]});
 input.acceptance.push({id:'pose',basis:'pose',question:'正面并立？',critical:true},{id:'feet',basis:'feet',question:'展示双鞋？',critical:true});
 const changed=reviseProductionInput(input,{request:'正面轻错步；鞋按裙摆自然遮挡，无需双脚露出。',channels:['composition','hands_feet'],sections:[{label:'姿态',items:[{text:'身体正面，一腿承重、另一脚略前，站姿稳定。',basis:['pose'],intent:'constraint'}]},{label:'脚部',items:[{text:'允许裙摆自然遮住双脚，检查可见部分与接地关系。',basis:['feet'],intent:'constraint'}]}],requirements:[{...input.requirements.find(r=>r.id==='pose'),text:'正面轻错步。'},{...input.requirements.find(r=>r.id==='feet'),text:'自然遮挡，可见结构与接地合理。'}],acceptance:[{...input.acceptance.find(r=>r.id==='pose'),question:'正面错步且平衡可信？'},{...input.acceptance.find(r=>r.id==='feet'),question:'可见结构与接地合理，未强行露鞋？'}]});
 assert.deepEqual(changed.input.references,input.references);assert.deepEqual(changed.input.sections.slice(0,2),input.sections.slice(0,2));assert.equal(changed.target_changed,true);assert.doesNotMatch(changed.compiled.prompt,/展示双鞋|正面并立/);
});
test('same-target repair counts once per initial task and snapshots cannot be overwritten',t=>{
 const {input,ref,dir}=setup(t),a=freeze(input);const revised=structuredClone(input);revised.sections[1].items[0].text+=' 衣服颜色为清楚的蓝色。';const b=freeze(revised,{run_id:'b',kind:'revision',parent:a});
 const output2=path.join(dir,'different.png');fs.writeFileSync(output2,Buffer.concat([fs.readFileSync(ref),Buffer.from('new test output')]));
 const s=summarizeProductionRuns([{snapshot:a,outcome:outcome(a,ref,'fail')},{snapshot:b,outcome:outcome(b,output2)}]).cohorts.test;
 assert.equal(s.initial_completed,1);assert.equal(s.initial_passed,0);assert.equal(s.resolved_without_goal_change,1);
 const dest=path.join(dir,'frozen.json');writeNew(dest,a);assert.throws(()=>writeNew(dest,b),/EEXIST/);
});

test('background channel accepts retained, adjusted, replaced and white targets without injecting presets',t=>{
 const {input}=setup(t);input.request='根据本轮描述决定背景，人物和衣服保持。';
 input.references.push({id:'ENV',source:'environment.jpg',inspected:true,generation_input:true,authority:['background'],facts:[{id:'scene',channel:'background',visibility:'visible',text:'庭院里有灰墙和花树。'}]});
 input.requirements.push({id:'BG',channel:'background',priority:'must',text:'按本轮要求处理背景。'});
 input.acceptance.push({id:'bg',basis:'BG',question:'场景是否符合本轮背景要求？',critical:true});
 for(const [intent,text] of [['retain','保留灰墙与花树庭院。'],['design','保留庭院，减弱后方花树的景深细节。'],['design','替换为有灰石地面的室内展厅，人物尺度与透视匹配。'],['design','背景替换为纯白无缝棚景。']]){
  const plan=structuredClone(input);plan.requirements.at(-1).text=text;
  plan.sections.push({label:'背景与空间',channel:'background',items:[{text,intent,basis:['scene','BG'],...(intent==='design'?{reason:'当前用户指定的背景处理。'}:{})}]});
  const c=compileProductionPrompt(plan);assert.equal(c.prompt,plan.sections.map(s=>`【${s.label}】\n${s.items.map(i=>i.text).join('\n')}`).join('\n\n'));
  assert.deepEqual(c.reference_inputs.at(-1),{id:'ENV',source:'environment.jpg'});
 }
});

test('background-only revisions preserve lighting and identity, and reject unapproved relighting',t=>{
 const {input}=setup(t);
 input.requirements.push({id:'BG',channel:'background',priority:'must',text:'保留庭院。'},{id:'LIGHT',channel:'lighting',priority:'must',text:'保留原场景柔光。'});
 input.sections.push({label:'背景',channel:'background',items:[{text:'保留庭院。',basis:['BG'],intent:'constraint'}]},{label:'光线',channel:'lighting',items:[{text:'保留原场景柔光。',basis:['LIGHT'],intent:'constraint'}]});
 input.acceptance.push({id:'bg',basis:'BG',question:'庭院保持？',critical:true},{id:'light',basis:'LIGHT',question:'柔光保持？',critical:true});
 const change={request:'只减少庭院杂物，其他不变。',channels:['background'],sections:[{label:'背景',items:[{text:'保留庭院，清理杂物。',basis:['BG'],intent:'constraint'}]}],requirements:[{...input.requirements.find(r=>r.id==='BG'),text:'保留庭院，清理杂物。'}],acceptance:[{...input.acceptance.find(r=>r.id==='bg'),question:'是否只清理庭院杂物？'}]};
 const result=reviseProductionInput(input,change);assert.deepEqual(result.input.sections.filter(s=>s.channel!=='background'),input.sections.filter(s=>s.channel!=='background'));assert.equal(result.target_changed,true);
 change.sections.push({label:'光线',items:[{text:'改成棚拍光。',basis:['LIGHT'],intent:'constraint'}]});assert.throws(()=>reviseProductionInput(input,change),/escaped allowed scope/);
});

test('an environment reference cannot control identity without explicit identity authority',t=>{
 const {input}=setup(t);
 input.references.push({id:'ENV',source:'environment.jpg',inspected:true,generation_input:true,authority:['background'],facts:[{id:'scene',channel:'background',visibility:'visible',text:'花树庭院。'}]});
 input.sections[0].items[0].basis.push('scene');assert.throws(()=>compileProductionPrompt(input),/ENV cannot control identity/);
});

test('expression reference controls facial action without inheriting identity authority',t=>{
 const {input}=setup(t);
 input.references.push({id:'EMOTION',source:'expression.jpg',inspected:true,generation_input:true,authority:['expression'],facts:[{id:'smile',channel:'expression',visibility:'visible',text:'嘴角轻提，唇部闭合，眼神放松。'}]});
 input.requirements.push({id:'EX',channel:'expression',priority:'must',text:'保留人物身份，采用自然闭唇浅笑。'});
 input.sections.push({label:'表情与眼神',channel:'expression',items:[{text:'采用嘴角轻提、闭唇与放松的眼神，人物五官来自主身份图。',basis:['smile','EX'],intent:'retain'}]});
 input.acceptance.push({id:'expression',basis:'EX',question:'是否自然闭唇浅笑？',critical:true});
 const c=compileProductionPrompt(input);assert.equal(c.status,'prompt_ready');assert.deepEqual(c.reference_inputs.map(r=>r.id),['R1','EMOTION']);
 input.sections[0].items[0].basis.push('smile');assert.throws(()=>compileProductionPrompt(input),/EMOTION cannot control identity/);
});

test('expression-only revisions preserve identity and presentation and cannot change head angle',t=>{
 const {input}=setup(t);input.requirements[0].text='保持本人稳定辨识点与原表观年龄。';
 for(const [channel,label,text] of [['expression','表情与眼神','闭唇浅笑，看镜头。'],['hair','发型','保留低束发。'],['composition','朝向','头部正对镜头。'],['background','背景','保留庭院。'],['lighting','光线','保留柔和场景光。']]){
  input.requirements.push({id:channel,channel,priority:'must',text});
  input.sections.push({label,channel,items:[{text,basis:[channel],intent:'constraint'}]});
  input.acceptance.push({id:channel,basis:channel,question:text,critical:true});
 }
 const change={request:'表情改为沉静认真，仍看镜头，其他保持。',channels:['expression'],sections:[{label:'表情与眼神',items:[{text:'收起笑意，嘴唇自然闭合，眼神沉静认真，仍看镜头。',basis:['expression'],intent:'constraint'}]}],requirements:[{...input.requirements.find(r=>r.id==='expression'),text:'沉静认真，仍看镜头。'}],acceptance:[{...input.acceptance.find(r=>r.id==='expression'),question:'是否沉静认真并看镜头？'}]};
 const result=reviseProductionInput(input,change);assert.deepEqual(result.input.references,input.references);assert.deepEqual(result.input.sections.filter(s=>s.channel!=='expression'),input.sections.filter(s=>s.channel!=='expression'));assert.deepEqual(result.input.requirements.filter(r=>r.channel!=='expression'),input.requirements.filter(r=>r.channel!=='expression'));assert.equal(result.target_changed,true);
 change.sections.push({label:'朝向',items:[{text:'转头看向侧面。',basis:['composition'],intent:'constraint'}]});assert.throws(()=>reviseProductionInput(input,change),/escaped allowed scope/);
});

test('action reference can direct movement without supplying the actor identity or wardrobe',t=>{
 const {input}=setup(t);
 input.references.push({id:'MOVE',source:'action.jpg',inspected:true,generation_input:true,authority:['action'],facts:[{id:'jump',channel:'action',visibility:'visible',text:'双脚离地，右腿屈收，双臂向外伸展。'}]});
 input.requirements.push({id:'ACT',channel:'action',priority:'must',text:'依动作参考表现跃起的单一瞬间。'});
 input.sections.push({label:'动作与身体关系',channel:'action',items:[{text:'采用参考的腾空、屈腿与双臂伸展关系，由当前人物完成。',basis:['jump','ACT'],intent:'retain'}]});
 input.acceptance.push({id:'action',basis:'ACT',question:'是否为指定腾空瞬间且身体关系可读？',critical:true});
 assert.equal(compileProductionPrompt(input).status,'prompt_ready');
 const face=structuredClone(input);face.sections[0].items[0].basis.push('jump');assert.throws(()=>compileProductionPrompt(face),/MOVE cannot control identity/);
 input.sections[1].items[0].basis.push('jump');assert.throws(()=>compileProductionPrompt(input),/MOVE cannot control costume/);
});

test('a proportion guide is bound as an input without gaining identity or clothing authority or output approval',t=>{
 const {input,dir,ref}=setup(t),guide=path.join(dir,'guide.png');fs.writeFileSync(guide,fs.readFileSync(ref));
 input.references.push({id:'GUIDE',source:guide,inspected:true,generation_input:true,authority:['proportion','composition'],facts:[{id:'guide-ratio',channel:'proportion',visibility:'visible',text:'Synthetic diagram: 120-unit head and 1080-unit figure; no real image approval.'}]});
 input.sections.find(s=>s.channel==='proportion').items[0].basis.push('guide-ratio');
 const s=freeze(input);
 assert.deepEqual(s.actual_inputs.map(r=>r.id),['R1','GUIDE']);
 assert.deepEqual(verifyFrozenRun(s).referenced_image_paths,[ref,guide]);
 for(const channel of ['identity','costume','hair','style']){
  const wrong=structuredClone(input);
  wrong.sections.push({label:`guide-${channel}`,channel,items:[{text:'错误地继承示意外观。',basis:['guide-ratio'],intent:'retain'}]});
  assert.throws(()=>compileProductionPrompt(wrong),new RegExp(`GUIDE cannot control ${channel}`));
 }
 const r={status:'completed',snapshot_sha256:s.snapshot_sha256,target_sha256:s.target_sha256,prompt_sha256:s.prompt_sha256,output_image:ref,output_sha256:promptHash(fs.readFileSync(ref)),inspected:true,reviewer:'synthetic test',checks:s.target.acceptance.map(c=>({id:c.id,verdict:c.id==='proportion'?'fail':'pass',evidence:'Synthetic result: valid guide did not establish output proportion.'}))};
 assert.equal(finishProductionRun(s,r).status,'needs_revision');
});

test('coordinated dynamic adaptation changes linked targets without reopening identity or wardrobe',t=>{
 const {input}=setup(t);
 const directions=[
  ['action','动作','静止站立。','跃起旋身的腾空瞬间，双臂舒展，身体方向协调。'],
  ['expression','表情','平静闭唇。','眼神专注运动方向，嘴角轻扬，表情与跃起意图协调。'],
  ['composition','取景','居中站立的静态取景。','完整轮廓入画，为旋身方向保留空间。'],
  ['hands_feet','可见手脚','双脚着地。','双脚离地，手腕与脚踝连接自然，可见结构不融合。'],
  ['material','动态衣料','衣摆静止垂落。','衣摆沿旋转方向滞后展开，布料重量与重力仍可读。']
 ];
 for(const [channel,label,text] of directions){input.requirements.push({id:channel,channel,priority:'must',text});input.sections.push({label,channel,items:[{text,basis:[channel],intent:'constraint'}]});input.acceptance.push({id:channel,basis:channel,question:text,critical:true});}
 const parent=freeze(input);
 const change={request:'允许夸张跃起动作，表情与衣料联动，保持人物和服装。',channels:directions.map(d=>d[0]),sections:directions.map(([channel,label,,text])=>({label,items:[{text,basis:[channel],intent:'constraint'}]})),requirements:directions.map(([channel,,,text])=>({...input.requirements.find(r=>r.id===channel),text})),acceptance:directions.map(([channel,,,text])=>({...input.acceptance.find(r=>r.id===channel),question:text}))};
 const r=reviseProductionInput(input,change),child=freeze(r.input,{run_id:'dynamic',kind:'revision',parent});
 assert.deepEqual(r.input.sections.slice(0,2),input.sections.slice(0,2));assert.deepEqual(r.input.references,input.references);assert.equal(child.goal_changed,true);assert.doesNotMatch(r.compiled.prompt,/静止站立|双脚着地|衣摆静止垂落/);
 change.sections.push({label:'衣服',items:[{text:'换成新的衣服。',basis:['U2'],intent:'constraint'}]});assert.throws(()=>reviseProductionInput(input,change),/escaped allowed scope/);
});

test('summaries reject status-only promotion and downgraded frozen critical checks',t=>{
 const {input,ref}=setup(t),snapshot=freeze(input);
 for(const verdict of ['fail','uncertain','not_assessable']){
  const original=outcome(snapshot,ref,verdict),before=structuredClone(original);
  const summary=summarizeProductionRuns([{snapshot,outcome:original}]).cohorts.test;
  assert.equal(summary.initial_passed,0);assert.equal(summary.resolved_without_goal_change,0);
  const forged={...structuredClone(original),status:'reviewer_qualified',critical_failures:[],unresolved:[]};
  forged.checks.forEach(c=>{c.critical=false;});
  assert.throws(()=>summarizeProductionRuns([{snapshot,outcome:{...original,status:'reviewer_qualified'}}]),/conflicts with frozen review/);
  assert.throws(()=>summarizeProductionRuns([{snapshot,outcome:forged}]),/conflicts with frozen review/);
  assert.deepEqual(original,before);
 }
});

test('summaries require complete bound observations and matching derived failure lists',t=>{
 const {input,ref}=setup(t),snapshot=freeze(input),original=outcome(snapshot,ref);
 const changes=[
  o=>{o.target_sha256='a'.repeat(64);},o=>{o.prompt_sha256='b'.repeat(64);},
  o=>{o.checks.pop();},o=>{o.checks.push(o.checks[0]);},o=>{o.checks[0].evidence=' ';},
  o=>{o.checks[0].critical=false;},o=>{o.checks[0].question='different target';},
  o=>{o.critical_failures=['proportion'];},o=>{o.unresolved=['proportion'];},
  o=>{delete o.execution_status;},o=>{o.inspected=false;},o=>{o.reviewer='';},
  o=>{o.output_sha256='';},o=>{o.status='unknown';}
 ];
 for(const change of changes){
  const corrupted=structuredClone(original);change(corrupted);
  assert.throws(()=>summarizeProductionRuns([{snapshot,outcome:corrupted}]));
 }
});

test('scope failures cannot be promoted through overall or effective scope status',t=>{
 const {input,ref}=setup(t),parent=freeze(input);
 const snapshot=freeze({...input,edit_scope:{baseline_reference_id:'R1',changes:['衣服表面'],preserve:['人物','背景']}},{run_id:'scope-child',kind:'edit',parent});
 const passed=outcome(snapshot,ref);
 for(const verdict of ['fail','uncertain','not_assessable']){
  const receipt={...passed,status:'completed',scope_review:{...passed.scope_review,preservation_checks:passed.scope_review.preservation_checks.map((c,i)=>({...c,verdict:i===1?verdict:'pass'}))}};
  const result=finishProductionRun(snapshot,receipt);
  const summarize=o=>summarizeProductionRuns([{snapshot:parent},{snapshot,outcome:o}]);
  assert.doesNotThrow(()=>summarize(result));
  assert.equal(result.scope_review.declared_verdict,'pass');
  assert.throws(()=>summarize({...result,status:'reviewer_qualified',critical_failures:[],unresolved:[]}),/conflicts with frozen review/);
  assert.throws(()=>summarize({...result,scope_review:{...result.scope_review,verdict:'pass'}}),/edit scope conflicts/);
  assert.throws(()=>summarize({...result,scope_review:{...result.scope_review,preservation_checks:[]}}),/preservation_checks/);
 }
});

test('portable summaries do not read output or reference files and retain legacy scope rules',t=>{
 const {input,ref}=setup(t),parent=freeze(input);
 const legacy=freeze({...input,edit_scope:{baseline_reference_id:'R1',changes:['表面'],preserve:['背景']}},{run_id:'legacy',kind:'edit',parent});
 delete legacy.scope_review_contract;
 const {snapshot_sha256,...body}=legacy;legacy.snapshot_sha256=objectHash(body);
 const result=outcome(legacy,ref);
 // The synthetic file is deliberately changed after review; summary checks declarations only.
 fs.appendFileSync(ref,'changed after recorded review');
 const report=summarizeProductionRuns([{snapshot:parent},{snapshot:legacy,outcome:result}]);
 assert.equal(report.user_acceptance,'not_inferred');
 assert.match(report.note,/no image files/);
 assert.throws(()=>finishProductionRun(legacy,{...result,status:'completed'}),/reference content changed/);
});

test('noncompleted outcomes cannot claim completion and unknown dispatch remains unknown',t=>{
 const {input}=setup(t),snapshot=freeze(input);
 const interrupted=finishProductionRun(snapshot,{snapshot_sha256:snapshot.snapshot_sha256,status:'interrupted',reason:'Synthetic stop.',dispatch_state:'unknown'});
 const error=finishProductionRun(snapshot,{snapshot_sha256:snapshot.snapshot_sha256,status:'tool_error',error:'Synthetic error.'});
 for(const original of [interrupted,error]){
  for(const patch of [{execution_status:'completed'},{output_sha256:'a'.repeat(64)},{checks:[]},{status:'reviewer_qualified'}])
   assert.throws(()=>summarizeProductionRuns([{snapshot,outcome:{...original,...patch}}]));
 }
 assert.throws(()=>summarizeProductionRuns([{snapshot,outcome:{...interrupted,dispatch_state:'guessed'}}]),/noncompleted/);
});
