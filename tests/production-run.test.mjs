import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {compileProductionPrompt,reviseProductionInput,promptHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun,finishProductionRun,summarizeProductionRuns,writeNew} from '../scripts/production-run.mjs';

function setup(t){
 const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'image-prompt-run-'));
 t.after(()=>{if(path.dirname(path.resolve(dir))!==parent)throw new Error('unsafe cleanup');fs.rmSync(dir,{recursive:true,force:true});});
 const ref=path.join(dir,'ref.png');fs.writeFileSync(ref,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'));
 const input={request:'保持参考人物，白底，蓝色衣服。',references:[{id:'R1',source:ref,inspected:true,generation_input:true,authority:['identity','costume'],facts:[{id:'F1',channel:'identity',visibility:'visible',text:'柔和下颌。'}]}],requirements:[{id:'U1',channel:'identity',priority:'must',text:'原人物。'},{id:'U2',channel:'costume',priority:'must',text:'蓝衣。'}],unresolved:[],sections:[{label:'人物',channel:'identity',items:[{text:'保留参考人物的柔和下颌。',basis:['F1','U1'],intent:'retain'}]},{label:'衣服',channel:'costume',items:[{text:'穿蓝色衣服。',basis:['U2'],intent:'constraint'}]}],acceptance:[{id:'face',basis:'U1',critical:true,question:'原人物？'},{id:'cloth',basis:'U2',critical:true,question:'蓝衣？'}]};
 return {dir,ref,input};
}
const freeze=(input,extra={})=>freezeProductionRun(input,{run_id:'a',case_id:'case',cohort:'test',...extra});
function outcome(s,ref,verdict='pass'){return finishProductionRun(s,{status:'completed',snapshot_sha256:s.snapshot_sha256,target_sha256:s.target_sha256,prompt_sha256:s.prompt_sha256,output_image:ref,output_sha256:promptHash(fs.readFileSync(ref)),inspected:true,reviewer:'synthetic test',checks:s.target.acceptance.map(c=>({id:c.id,verdict,evidence:'Synthetic fixture; not visual approval.'}))});}

test('frozen tool arguments preserve exact text and actual input order, without evaluation references',t=>{
 const {input}=setup(t);input.references.push({...structuredClone(input.references[0]),id:'judge',generation_input:false,authority:['style'],facts:[{id:'F2',channel:'style',visibility:'visible',text:'评价标杆。'}]});
 const s=freeze(input),args=verifyFrozenRun(s);assert.equal(args.prompt,compileProductionPrompt(input).prompt);assert.deepEqual(args.referenced_image_paths,[input.references[0].source]);
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
 const changed=reviseProductionInput(input,{request:'正面轻错步；鞋按裙摆自然遮挡，无需双脚露出。',channels:['composition','hands_feet'],sections:[{label:'姿态',items:[{text:'身体正面，一腿承重、另一脚略前，站姿稳定。',basis:['pose'],intent:'constraint'}]},{label:'脚部',items:[{text:'允许裙摆自然遮住双脚，检查可见部分与接地关系。',basis:['feet'],intent:'constraint'}]}],requirements:[{...input.requirements[2],text:'正面轻错步。'},{...input.requirements[3],text:'自然遮挡，可见结构与接地合理。'}],acceptance:[{...input.acceptance[2],question:'正面错步且平衡可信？'},{...input.acceptance[3],question:'可见结构与接地合理，未强行露鞋？'}]});
 assert.deepEqual(changed.input.references,input.references);assert.deepEqual(changed.input.sections.slice(0,2),input.sections.slice(0,2));assert.equal(changed.target_changed,true);assert.doesNotMatch(changed.compiled.prompt,/展示双鞋|正面并立/);
});
test('same-target repair counts once per initial task and snapshots cannot be overwritten',t=>{
 const {input,ref,dir}=setup(t),a=freeze(input);const revised=structuredClone(input);revised.sections[1].items[0].text+=' 衣服颜色为清楚的蓝色。';const b=freeze(revised,{run_id:'b',kind:'revision',parent:a});
 const output2=path.join(dir,'different.png');fs.writeFileSync(output2,Buffer.concat([fs.readFileSync(ref),Buffer.from('new test output')]));
 const s=summarizeProductionRuns([{snapshot:a,outcome:outcome(a,ref,'fail')},{snapshot:b,outcome:outcome(b,output2)}]).cohorts.test;
 assert.equal(s.initial_completed,1);assert.equal(s.initial_passed,0);assert.equal(s.resolved_without_goal_change,1);
 const dest=path.join(dir,'frozen.json');writeNew(dest,a);assert.throws(()=>writeNew(dest,b),/EEXIST/);
});
