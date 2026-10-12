import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyReferenceFacePreset,assertReferenceFacePresetBindings,listReferenceFacePresets,resolveReferenceFacePreset} from '../scripts/reference-face-presets.mjs';
import {compileProductionPrompt,objectHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';

function metadata(id='RP-A01') {
  const preset=resolveReferenceFacePreset(id);
  return {id:'R1',source:'synthetic-metadata-only.jpg',inspected:true,generation_input:true,authority:['identity'],
    identity_role:'primary',identity_target_id:preset.id,content_sha256:preset.source_sha256,
    facts:[{id:'F1',channel:'identity',visibility:'partial',text:'合成的局部面容声明；本测试没有检查真实像素。'}]};
}

function brief(source) {
  return {subject_kind:'character',request:'合成契约测试，保持输入人物的可见头肩；不代表真实图像验收。',
    references:[{id:'R1',source,inspected:true,generation_input:true,authority:['identity'],facts:[
      {id:'F1',channel:'identity',visibility:'partial',text:'合成的局部面容声明；本测试没有检查真实像素。'}]}],
    unresolved:[],requirements:[{id:'identity',channel:'identity',priority:'must',text:'保持原身份。'},
      {id:'proportion',channel:'proportion',priority:'must',text:'仅评估可见头颈肩的协调关系。'}],
    sections:[{label:'人物',channel:'identity',items:[{text:'保持参考可见的面容关系，未知部分不声明精确复刻。',basis:['identity','F1'],intent:'retain'}]},
      {label:'可见比例',channel:'proportion',items:[{text:'可见头颈肩协调，不推断未显示身体。',basis:['proportion'],intent:'constraint'}]}],
    acceptance:[{id:'identity-check',basis:'identity',critical:true,question:'可见身份是否保持？'},
      {id:'proportion-check',basis:'proportion',critical:true,question:'可见头颈肩是否协调？'}]};
}

function temporaryImage(t) {
  const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'reference-face-preset-'));
  t.after(()=>{const relative=path.relative(parent,path.resolve(dir));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('unsafe temporary cleanup');fs.rmSync(dir,{recursive:true,force:true});});
  const file=path.join(dir,'synthetic.png');
  fs.writeFileSync(file,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'));
  return file;
}

function syntheticSnapshot(ref) {
  const input=brief(ref.source),compiled=compileProductionPrompt(input);
  const target={subject_kind:input.subject_kind,requirements:input.requirements,acceptance:compiled.acceptance,
    identity_targets:[{identity_group:null,identity_target_id:ref.identity_target_id,origin:{reference_id:ref.id,content_sha256:ref.content_sha256}}]};
  const record={schema_version:1,target_contract:'identity_sources_v1',run_id:'synthetic-metadata',case_id:'binding-only',cohort:'test',kind:'initial',
    target,target_sha256:objectHash(target),references:[ref],prompt:compiled.prompt,prompt_sha256:compiled.prompt_sha256,
    actual_inputs:[{id:ref.id,source:ref.source,content_sha256:ref.content_sha256}]};
  return {...record,snapshot_sha256:objectHash(record)};
}

test('RP registry preserves 25 uploads as 24 file contents and never claims 24 identities',()=>{
  const registry=listReferenceFacePresets(),entries=Object.values(registry.presets);
  assert.equal(registry.source_upload_count,25);assert.equal(registry.preset_count,24);
  assert.equal(new Set(entries.map(row=>row.source_sha256)).size,24);
  assert.equal(registry.identity_count,'not_established');assert.equal(registry.source_images_bundled,false);
  assert.deepEqual(registry.candidate_policy,{use:'preview_only',may_replace_identity_source:false});
  for(const row of entries)assert.deepEqual(Object.keys(row).sort(),['aliases','source_record_ids','source_sha256','title']);
  assert.notEqual(resolveReferenceFacePreset('RP-A05').source_sha256,resolveReferenceFacePreset('RP-B11').source_sha256);
});

test('byte-identical upload alias resolves to the original canonical preset',()=>{
  const alias=resolveReferenceFacePreset('RP-A06'),canonical=resolveReferenceFacePreset('RP-A02');
  assert.deepEqual(alias,canonical);assert.equal(alias.id,'RP-A02');
  assert.deepEqual(alias.source_record_ids,['A02','A06']);
  assert.throws(()=>resolveReferenceFacePreset('RP-X01'),/unknown reference-face preset/);
});

test('fixed original digest metadata binds every canonical RP without approving pixels',()=>{
  for(const id of Object.keys(listReferenceFacePresets().presets))assert.doesNotThrow(()=>assertReferenceFacePresetBindings([metadata(id)]));
  assert.doesNotThrow(()=>assertReferenceFacePresetBindings([]));
  assert.doesNotThrow(()=>assertReferenceFacePresetBindings([{...metadata(),identity_target_id:'custom-character'}]));
});

test('misbound, unknown, alias and normalized digests cannot become canonical identity sources',()=>{
  const ref=metadata();
  for(const digest of ['0'.repeat(64),resolveReferenceFacePreset('RP-B01').source_sha256])
    assert.throws(()=>assertReferenceFacePresetBindings([{...ref,content_sha256:digest}]),/exact original file bytes/);
  assert.throws(()=>assertReferenceFacePresetBindings([{...ref,identity_target_id:'RP-X01'}]),/unknown reference-face preset/);
  assert.throws(()=>assertReferenceFacePresetBindings([{...metadata('RP-A02'),identity_target_id:'RP-A06'}]),/canonical preset id/);
  assert.throws(()=>assertReferenceFacePresetBindings([{...ref,content_sha256:'0'.repeat(64),normalized_sha256:ref.content_sha256}]),/exact original file bytes/);
});

test('RP source needs actual input, inspection and sole primary identity authority',()=>{
  const ref=metadata();
  for(const patch of [{generation_input:false},{inspected:false},{identity_role:'support'},{authority:['style']}])
    assert.throws(()=>assertReferenceFacePresetBindings([{...ref,...patch}]),/original|identity authority/);
  const support={...ref,id:'R2',identity_target_id:'other-person',identity_role:'support'};
  assert.throws(()=>assertReferenceFacePresetBindings([ref,support]),/other identities cannot be mixed/);
});

test('candidate review status never promotes its bytes to RP identity',()=>{
  for(const status of ['pass','fail','uncertain','not_assessable','reviewer_qualified'])
    assert.throws(()=>assertReferenceFacePresetBindings([{...metadata(),content_sha256:'0'.repeat(64),candidate_review:status}]),/exact original file bytes/);
});

test('apply rejects real temporary image bytes and offers no configurable registry bypass',t=>{
  const input=brief(temporaryImage(t)),before=structuredClone(input),selection={preset_id:'RP-A01',reference_id:'R1'};
  assert.throws(()=>applyReferenceFacePreset(input,selection),/exact original file bytes/);
  assert.deepEqual(input,before);
  assert.throws(()=>applyReferenceFacePreset(input,{...selection,normalized_sha256:metadata().content_sha256}),/unsupported reference-face selection/);
  assert.throws(()=>applyReferenceFacePreset(input,selection,{catalog:{presets:{}}}),/unsupported reference-face options/);
  assert.throws(()=>applyReferenceFacePreset(input,{...selection,preset_id:'RP-X01'}),/unknown reference-face preset/);
});

test('freeze recomputes source bytes and rejects a candidate retaining the original RP target',t=>{
  const input=brief(temporaryImage(t));
  input.references[0].identity_target_id='RP-A01';
  assert.throws(()=>freezeProductionRun(input,{run_id:'synthetic',case_id:'binding',cohort:'test'}),/exact original file bytes/);
});

test('snapshot verification checks fixed original binding even when pixel files are not loaded',()=>{
  const snapshot=syntheticSnapshot(metadata());
  assert.deepEqual(verifyFrozenRun(snapshot,{verifyFiles:false}).referenced_image_paths,['synthetic-metadata-only.jpg']);
  const changed=structuredClone(snapshot),replacement='0'.repeat(64);
  changed.references[0].content_sha256=replacement;changed.actual_inputs[0].content_sha256=replacement;
  const {snapshot_sha256,...body}=changed;changed.snapshot_sha256=objectHash(body);
  assert.throws(()=>verifyFrozenRun(changed,{verifyFiles:false}),/exact original file bytes/);
});
