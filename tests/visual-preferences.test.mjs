import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyVisualPreferences,buildVisualPreferenceSelection,listVisualPreferences,loadVisualPreferenceCatalog,resolveVisualPreference,validateVisualPreferenceCatalog} from '../scripts/visual-preferences.mjs';
import {compileProductionPrompt,objectHash} from '../scripts/production-prompt.mjs';
import {freezeProductionRun,verifyFrozenRun} from '../scripts/production-run.mjs';

const dimensionChannels={face:'identity',expression:'expression',makeup:'makeup',hair:'hair',costume:'costume',material:'material',pose:'action',lighting:'lighting',palette:'style',composition:'composition',scene:'background',creature:'background',medium:'style'};
const allContexts=['new_character','scene_creation','reference_preserve','portrait_standardization','costume_design','style_conversion'];
const observation=(dimension,transfer,visibility='visible')=>({dimension,visibility,text:`合成${dimension}声明，测试没有检查真实参考像素。`,transfer,limits:['测试声明不证明新输出质量。']});
function asset(id,digest,observations,extra={}){
  return {id,title:`合成参考 ${id}`,aliases:[],source:{sha256:digest,local_path:`missing-local-visual-preferences/${id}.png`,availability:'historical_record',source_records:[`test-upload-${id}`]},
    feedback:{status:'provided_preference',scope:'whole_image',quote:'这些是视觉偏好参考。'},inspection:{status:'historical_pixels'},subjects:['人物'],genres:['东方幻想'],medium:'painterly',framing:'合成头肩视角声明。',collections:['synthetic'],identity_preset_id:null,observations,limits:['不将这幅图默认当作任何已有角色的身份图。'],...extra};
}
function fixture(){
  const first=asset('VP-WARM','1'.repeat(64),[
    observation('face','新人物可采用柔和的脸部轮廓与协调的眉眼关系。'),observation('hair','使用层次疏密清楚的长发与细散发束。'),
    observation('lighting','使用偏暖的侧逆光，并保持脸部读形。'),observation('palette','采用赭红与暗青的色彩关系。'),
    observation('makeup','采用薄妆与柔和的唇色。','partial'),observation('material','表现丝织物的低亮度反射。'),
    observation('pose','保持明确的重心与肩胯姿态。'),observation('composition','用清楚的前后景层次组织人物。'),
    observation('scene','采用能支撑人物尺度的古建筑环境。'),observation('creature','采用巨兽与人物的清楚尺度对照。'),
    observation('medium','使用带选择性笔触的材质表现。'),observation('costume','采用有层次的披帛与裙装。'),
    observation('expression','保留平静而清楚的视线方向。')]);first.aliases=['VP-WARM-UPLOAD-DUPLICATE'];first.identity_preset_id='RP-A01';
  const second=asset('VP-COOL','2'.repeat(64),[observation('lighting','使用偏冷的均匀侧光。'),observation('hair','保留清楚的发束分组。')]);second.medium='cg_precise';second.genres=['科幻'];
  const uncertain=asset('VP-UNKNOWN','3'.repeat(64),[observation('face','不可把模糊原图当作已确认脸型。','unknown'),observation('costume','原图只支持局部披帛的材质和边缘。','partial'),observation('material','')]);
  const pointer=asset('VP-POINTER',null,[observation('lighting','此条仅来自历史文字记录，没有可用像素观察。')],{source:{sha256:null,local_path:null,availability:'external_pointer',source_records:['https://example.invalid/source-record']},inspection:{status:'record_only'}});
  const rejected=asset('VP-REJECTED','4'.repeat(64),[observation('face','不可把被否定的脸作为偏好。')],{feedback:{status:'rejected_sample',scope:'whole_image',quote:'太假了。'}});
  return {schema_version:1,source_images_bundled:false,dimensions:Object.fromEntries(Object.entries(dimensionChannels).map(([id,channel])=>[id,{label:{face:'面容',expression:'神态',makeup:'妆容',hair:'发型',costume:'服装',material:'材质',pose:'姿态',lighting:'受光',palette:'配色',composition:'构图',scene:'场景',creature:'生物',medium:'媒介'}[id],production_channel:channel}])),
    collections:{synthetic:{label:'合成契约集合',description:'只验证管理与安全约束，不宣称实际图像测试。',contexts:allContexts}},assets:[first,second,uncertain,pointer,rejected]};
}
function input(dimensions=['hair','makeup'],asset_id='VP-WARM',context='new_character'){return {id:'synthetic-preference',context,selections:[{asset_id,dimensions}]};}
function brief(subject_kind='character'){
  const requirements=[{id:'task',channel:'task',priority:'must',text:'采用本轮明确的合成测试内容。'},...(subject_kind==='character'?[{id:'proportion',channel:'proportion',priority:'must',text:'可见体态与构图协调。'}]:[])];
  return {subject_kind,request:'合成测试；验证视觉偏好投影约束，不代表实际媒体质量。',references:[],unresolved:[],requirements,
    sections:requirements.map(row=>({label:row.id==='task'?'当前内容':'当前比例',channel:row.channel,items:[{text:row.text,basis:[row.id],intent:'constraint'}]})),
    acceptance:requirements.map(row=>({id:`${row.id}-check`,basis:row.id,critical:true,question:'明确目标是否保持？'})),metadata:{authored_note:'现有元数据必须保留。'}};
}
function withIdentity(source='unread-reference.png'){
  const result=brief();result.references=[{id:'ORIGINAL',source,inspected:true,generation_input:true,authority:['identity'],identity_target_id:'RP-A01',facts:[{id:'original-identity',channel:'identity',visibility:'partial',text:'合成可见身份声明。'}]}];return result;
}
function temporary(t){
  const parent=path.resolve(os.tmpdir()),dir=fs.mkdtempSync(path.join(parent,'visual-preferences-'));
  t.after(()=>{const relative=path.relative(parent,path.resolve(dir));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('unsafe temporary cleanup');fs.rmSync(dir,{recursive:true,force:true});});return dir;
}

test('catalog validates declarations without requiring current files or certifying feedback and pixels',t=>{
  const catalog=fixture(),before=structuredClone(catalog),result=validateVisualPreferenceCatalog(catalog);
  assert.equal(result.asset_count,5);assert.equal(result.hash_bound_asset_count,4);assert.equal(result.alias_count,1);assert.equal(result.source_images_bundled,false);
  assert.deepEqual(result.evidence,{pixel_analysis_performed:false,visual_quality_verified:false,user_acceptance_authenticated:false});assert.deepEqual(catalog,before);
  const file=path.join(temporary(t),'catalog.json');fs.writeFileSync(file,JSON.stringify(catalog));assert.deepEqual(loadVisualPreferenceCatalog(file),catalog);
  assert.equal(fs.existsSync(catalog.assets[0].source.local_path),false);
});

test('catalog rejects duplicate file contents, conflicting aliases and arbitrary channel remapping',()=>{
  for(const mutate of [c=>{c.assets[1].source.sha256=c.assets[0].source.sha256;},c=>{c.assets[1].id=c.assets[0].id;},c=>{c.assets[1].aliases=['VP-WARM'];},c=>{c.assets[1].aliases=[c.assets[0].aliases[0]];},c=>{c.dimensions.lighting.production_channel='identity';},c=>{delete c.dimensions.face;},c=>{c.source_images_bundled=true;}]){
    const catalog=fixture();mutate(catalog);assert.throws(()=>validateVisualPreferenceCatalog(catalog));
  }
});

test('catalog sources use relative locators and valid declarations but do not silently accept typos',()=>{
  for(const mutate of [c=>{c.assets[0].source.local_path='D:/Temp/source.png';},c=>{c.assets[0].source.local_path='/absolute/source.png';},c=>{c.assets[0].source.local_path='\\\\server\\source.png';},c=>{c.assets[0].source.availability='local_verified';c.assets[0].source.sha256=null;},c=>{c.assets[0].source.sha256='invalid';},c=>{c.assets[0].medium='cinematic';},c=>{c.assets[0].observations[0].dimension='skinny';},c=>{c.assets[0].observations[0].visibility='confirmed';},c=>{c.assets[0].feedback.scope='face';},c=>{c.collections.synthetic.contexts=['anything'];},c=>{c.assets[0].custom=true;}]){
    const catalog=fixture();mutate(catalog);assert.throws(()=>validateVisualPreferenceCatalog(catalog));
  }
});

test('query dimensions, collections, genre, medium and text combine while rejected samples stay opt-in',()=>{
  const catalog=fixture();assert.equal(listVisualPreferences({}, {catalog}).length,4);assert.equal(listVisualPreferences({include_rejected:true},{catalog}).length,5);
  assert.deepEqual(listVisualPreferences({dimension:'hair',collection:'synthetic',genre:'科幻',medium:'cg_precise',search:'发束'},{catalog}).map(row=>row.id),['VP-COOL']);
  assert.deepEqual(listVisualPreferences({search:'warm-upload-duplicate'},{catalog}).map(row=>row.id),['VP-WARM']);
  assert.deepEqual(listVisualPreferences({dimension:'scene',medium:'cg_precise'},{catalog}),[]);
  const alias=resolveVisualPreference('VP-WARM-UPLOAD-DUPLICATE',{catalog});assert.equal(alias.id,'VP-WARM');alias.title='cannot mutate catalog';assert.notEqual(catalog.assets[0].title,alias.title);
});

test('unknown query keys and values are errors instead of accidentally returning all preferences',()=>{
  const catalog=fixture();for(const filter of [{dimenson:'hair'},{dimension:'skinny'},{collection:'unknown'},{genre:'missing'},{medium:'unknown-style'},{search:''},{include_rejected:'true'}])assert.throws(()=>listVisualPreferences(filter,{catalog}));
  assert.throws(()=>resolveVisualPreference('missing',{catalog}),/unknown visual preference asset/);
  assert.throws(()=>listVisualPreferences({}, {catalog,accept_all:true}),/unsupported visual preference options/);
});

test('selection keeps declared partial provenance and excludes unknown, record-only and empty transfer observations',()=>{
  const catalog=fixture(),selected={id:'mixed-evidence',context:'new_character',selections:[{asset_id:'VP-UNKNOWN',dimensions:['face','costume','material']},{asset_id:'VP-POINTER',dimensions:['lighting']}]};
  const result=buildVisualPreferenceSelection(selected,{catalog});assert.deepEqual(result.projections.map(row=>row.dimension),['costume']);
  assert.equal(result.projections[0].observations[0].visibility,'partial');assert.deepEqual(result.projections[0].source,catalog.assets[2].source);
  assert.deepEqual(result.excluded.map(row=>row.reason),['unknown','no_transfer','unbound_source']);assert.equal(result.evidence.visual_quality_verified,false);assert.equal(result.evidence.user_accepted,false);
  assert.throws(()=>buildVisualPreferenceSelection(input(['face'],'VP-UNKNOWN'),{catalog}),/no reusable visible/);
  assert.throws(()=>buildVisualPreferenceSelection(input(['lighting'],'VP-POINTER'),{catalog}),/no reusable visible/);
});

test('historical inspection labels cannot promote external pointers or digestless records to a bound primary source',()=>{
  for(const variant of ['external-with-digest','historical-without-digest']){
    const catalog=fixture(),pointer=catalog.assets.find(row=>row.id==='VP-POINTER');
    if(variant==='external-with-digest'){pointer.source.sha256='5'.repeat(64);pointer.inspection.status='historical_pixels';}
    else {pointer.source.availability='historical_record';pointer.inspection.status='actual_pixels';}
    assert.doesNotThrow(()=>validateVisualPreferenceCatalog(catalog));
    const mixed={id:'bound-and-pointer',context:'scene_creation',selections:[{asset_id:'VP-WARM',dimensions:['scene']},{asset_id:'VP-POINTER',dimensions:['lighting']}]};
    const selected=buildVisualPreferenceSelection(mixed,{catalog});assert.deepEqual(selected.projections.map(row=>row.asset_id),['VP-WARM']);assert.equal(selected.excluded[0].reason,'unbound_source');
    assert.equal(selected.excluded[0].asset_id,'VP-POINTER');assert.equal(resolveVisualPreference('VP-POINTER',{catalog}).inspection.status,pointer.inspection.status);
    assert.throws(()=>buildVisualPreferenceSelection(input(['lighting'],'VP-POINTER','scene_creation'),{catalog}),/no reusable visible/);
  }
  const recordOnly=fixture();recordOnly.assets[0].inspection.status='record_only';assert.throws(()=>buildVisualPreferenceSelection(input(['hair']),{catalog:recordOnly}),/no reusable visible/);
});

test('visual limits constrain transfer in prose while evidence notes stay metadata and authored must targets remain intact',()=>{
  const catalog=fixture(),hair=catalog.assets[0].observations.find(row=>row.dimension==='hair');
  hair.transfer='借鉴发束的疏密与飘动层次。';hair.visual_limits=['只借鉴发束组织，保持本轮黑色发色，不引入参考中的蓝色染发。'];
  hair.limits=['用户未评分，不构成新输出的已接受证明。','不能确认原图的拍摄设备。'];
  const authored=brief();authored.requirements.push({id:'black-hair',channel:'hair',priority:'must',text:'本角色保持黑色头发。'});authored.sections.push({label:'本角色发色',channel:'hair',items:[{text:'本角色保持黑色头发。',basis:['black-hair'],intent:'constraint'}]});authored.acceptance.push({id:'black-hair-check',basis:'black-hair',critical:true,question:'本角色的黑色发色是否保持？'});
  const selected=buildVisualPreferenceSelection(input(['hair']),{catalog}),applied=applyVisualPreferences(authored,selected,{catalog}),prompt=compileProductionPrompt(applied).prompt;
  assert.match(prompt,/借鉴边界：只借鉴发束组织，保持本轮黑色发色，不引入参考中的蓝色染发/);
  for(const note of hair.limits)assert.equal(prompt.includes(note),false);
  assert.deepEqual(applied.requirements.filter(row=>row.priority==='must'),authored.requirements);assert.deepEqual(applied.acceptance.filter(row=>row.critical),authored.acceptance);
  assert.deepEqual(selected.projections[0].visual_limits,hair.visual_limits);assert.deepEqual(selected.projections[0].observations[0].visual_limits,hair.visual_limits);
  const snapshot=freezeProductionRun(applied,{run_id:'synthetic-visual-boundary',case_id:'hair-color',cohort:'test'}),frozen=snapshot.target.requirements.find(row=>row.visual_preference_selection).visual_preference_selection;
  assert.deepEqual(frozen.projections[0].visual_limits,hair.visual_limits);assert.ok(frozen.projections[0].limits.includes(hair.limits[0]));
  const altered=structuredClone(selected);altered.projections[0].visual_limits=['把头发改成蓝色。'];assert.throws(()=>applyVisualPreferences(authored,altered,{catalog}),/hash changed/);
  for(const value of ['保持黑色发色。',['重复边界。','重复边界。']]){const malformed=fixture();malformed.assets[0].observations[1].visual_limits=value;assert.throws(()=>validateVisualPreferenceCatalog(malformed),/visual limits/);}
});

test('scene creation accepts an authored character in an environment without injecting creature identities or image inputs',()=>{
  const catalog=fixture(),authored=withIdentity(),selected=input(['lighting','scene','creature'],'VP-WARM','scene_creation');
  authored.request='合成契约测试：现有角色与白狮同处古建筑环境，不检查实际图片。';
  const applied=applyVisualPreferences(authored,selected,{catalog});assert.deepEqual(applied.references,authored.references);assert.equal(applied.references.length,1);assert.deepEqual(applied.references[0].authority,['identity']);assert.equal(applied.references[0].identity_target_id,'RP-A01');
  assert.deepEqual(applied.requirements.filter(row=>row.priority==='must'),authored.requirements);assert.deepEqual(applied.requirements.filter(row=>row.id.startsWith('VP:')).map(row=>row.channel),['lighting','background','background']);
  assert.deepEqual(compileProductionPrompt(applied).reference_inputs,[{id:'ORIGINAL',source:'unread-reference.png'}]);
  assert.equal(applied.metadata.visual_preferences.source_images_added,false);assert.equal(applied.metadata.visual_preferences.identity_authority_added,false);
  assert.doesNotThrow(()=>applyVisualPreferences(brief('scene'),selected,{catalog}));
  assert.throws(()=>applyVisualPreferences(brief('product'),selected,{catalog}),/context conflicts/);
  assert.throws(()=>applyVisualPreferences(authored,input(['face'],'VP-WARM','scene_creation'),{catalog}),/face borrowing is allowed only/);
});

test('only one primary asset may supply each dimension and duplicate upload aliases cannot stack',()=>{
  const catalog=fixture();
  assert.throws(()=>buildVisualPreferenceSelection({id:'light-conflict',context:'new_character',selections:[{asset_id:'VP-WARM',dimensions:['lighting']},{asset_id:'VP-COOL',dimensions:['lighting']}]},{catalog}),/already has a primary asset/);
  assert.throws(()=>buildVisualPreferenceSelection({id:'alias-conflict',context:'new_character',selections:[{asset_id:'VP-WARM',dimensions:['hair']},{asset_id:'VP-WARM-UPLOAD-DUPLICATE',dimensions:['makeup']}]},{catalog}),/duplicate canonical asset/);
  assert.throws(()=>buildVisualPreferenceSelection(input(['hair','hair']),{catalog}),/unique nonempty strings/);
  assert.throws(()=>buildVisualPreferenceSelection(input(['lighting'],'VP-REJECTED'),{catalog}),/rejected sample/);
});

test('contexts enforce collection applicability and block style references from changing standardized tests',()=>{
  const catalog=fixture();
  for(const dimension of ['lighting','palette','composition','pose','scene','creature','medium'])assert.throws(()=>buildVisualPreferenceSelection(input([dimension],'VP-WARM','portrait_standardization'),{catalog}),/cannot borrow/);
  for(const context of ['reference_preserve','portrait_standardization','costume_design','style_conversion','scene_creation'])assert.throws(()=>buildVisualPreferenceSelection(input(['face'],'VP-WARM',context),{catalog}),/face borrowing is allowed only/);
  const restricted=fixture();restricted.collections.synthetic.contexts=['style_conversion'];assert.throws(()=>buildVisualPreferenceSelection(input(),{catalog:restricted}),/unavailable for visual preference context/);
  assert.throws(()=>buildVisualPreferenceSelection({...input(),context:'auto'},{catalog}),/supported context/);
  assert.throws(()=>buildVisualPreferenceSelection({...input(),strength:1},{catalog}),/unsupported visual preference selection input/);
  assert.throws(()=>buildVisualPreferenceSelection(input(['scene'],'VP-COOL'),{catalog}),/no declared observation/);
});

test('apply projects only visual transfer prose and keeps provenance metadata separate from the prompt',()=>{
  const catalog=fixture(),authored=brief(),before=structuredClone(authored),selection=buildVisualPreferenceSelection(input(),{catalog}),applied=applyVisualPreferences(authored,selection,{catalog});
  assert.deepEqual(authored,before);assert.deepEqual(applied.references,before.references);
  assert.deepEqual(applied.requirements.filter(row=>row.priority==='must'),before.requirements);assert.deepEqual(applied.acceptance.filter(row=>row.critical),before.acceptance);
  const added=applied.requirements.filter(row=>row.id.startsWith('VP:'));assert.equal(added.length,2);assert.ok(added.every(row=>row.priority==='prefer'));
  assert.ok(applied.acceptance.filter(row=>row.id.startsWith('VP:')).every(row=>row.critical===false));
  const compiled=compileProductionPrompt(applied);assert.match(compiled.prompt,/层次疏密清楚的长发/);assert.match(compiled.prompt,/仅借鉴可见部分/);
  for(const metadataText of ['VP-WARM','test-upload','1'.repeat(64),'RP-A01','selection_sha256','合成hair声明'])assert.ok(!compiled.prompt.includes(metadataText));
  assert.equal(applied.metadata.authored_note,before.metadata.authored_note);assert.equal(applied.metadata.visual_preferences.source_images_added,false);assert.equal(applied.metadata.visual_preferences.identity_authority_added,false);
  assert.deepEqual(added[0].visual_preference_selection,selection);
});

test('face borrowing designs a new character but never binds the aesthetic image as its identity source',()=>{
  const catalog=fixture(),selection=input(['face']),authored=brief(),applied=applyVisualPreferences(authored,selection,{catalog});
  assert.equal(applied.references.length,0);assert.equal(applied.requirements.find(row=>row.id.startsWith('VP:')).channel,'identity');
  assert.equal(applied.metadata.visual_preferences.identity_authority_added,false);
  assert.throws(()=>applyVisualPreferences(withIdentity(),selection,{catalog}),/cannot replace an existing identity reference/);
  const unregistered=withIdentity();delete unregistered.references[0].identity_target_id;assert.throws(()=>applyVisualPreferences(unregistered,selection,{catalog}),/cannot replace an existing identity reference/);
  assert.throws(()=>applyVisualPreferences(brief('scene'),selection,{catalog}),/context conflicts/);
});

test('other dimension borrowing preserves RP reference inputs and authored standardization targets',()=>{
  const catalog=fixture(),authored=withIdentity();
  authored.requirements.push({id:'neutral-light',channel:'lighting',priority:'must',text:'采用明确的中性均匀受光。'});authored.sections.push({label:'测试光线',channel:'lighting',items:[{text:'采用明确的中性均匀受光。',basis:['neutral-light'],intent:'constraint'}]});authored.acceptance.push({id:'neutral-light-check',basis:'neutral-light',critical:true,question:'统一光线是否保持？'});
  const applied=applyVisualPreferences(authored,input(['hair','makeup'],'VP-WARM','portrait_standardization'),{catalog});
  assert.deepEqual(applied.references,authored.references);assert.deepEqual(applied.requirements.find(row=>row.id==='neutral-light'),authored.requirements.find(row=>row.id==='neutral-light'));
  assert.deepEqual(compileProductionPrompt(applied).reference_inputs,[{id:'ORIGINAL',source:'unread-reference.png'}]);
  assert.throws(()=>applyVisualPreferences(authored,input(['lighting'],'VP-WARM','portrait_standardization'),{catalog}),/cannot borrow lighting/);
});

test('local edit preferences need explicit allowed channels and never expand scope changes or preservation',()=>{
  const catalog=fixture(),authored=withIdentity();authored.edit_scope={baseline_reference_id:'ORIGINAL',changes:['只调整发束分组。'],preserve:['原面容、服装与灯光保持。']};
  assert.throws(()=>applyVisualPreferences(authored,input(['hair'],'VP-WARM','reference_preserve'),{catalog}),/explicit allowed_edit_channels/);
  assert.throws(()=>applyVisualPreferences(authored,input(['hair','costume'],'VP-WARM','reference_preserve'),{catalog,allowed_edit_channels:['hair']}),/escaped allowed edit channels/);
  assert.throws(()=>applyVisualPreferences(authored,input(['hair'],'VP-WARM','reference_preserve'),{catalog,allowed_edit_channels:['hairs']}),/unknown allowed edit channel/);
  const applied=applyVisualPreferences(authored,input(['hair'],'VP-WARM','reference_preserve'),{catalog,allowed_edit_channels:['hair']});assert.deepEqual(applied.edit_scope,authored.edit_scope);assert.deepEqual(applied.references,authored.references);
  assert.throws(()=>applyVisualPreferences(brief(),input(['makeup']),{catalog,allowed_edit_channels:['hair']}),/escaped allowed edit channels/);
});

test('repeated application, altered derived projections and stale catalogs require a fresh authored build',()=>{
  const catalog=fixture(),authored=brief(),selection=buildVisualPreferenceSelection(input(),{catalog}),applied=applyVisualPreferences(authored,selection,{catalog});
  assert.throws(()=>applyVisualPreferences(applied,input(['costume']),{catalog}),/rebuild from the authored brief/);
  const removedMetadata=structuredClone(applied);delete removedMetadata.metadata.visual_preferences;assert.throws(()=>applyVisualPreferences(removedMetadata,input(['costume']),{catalog}),/rebuild from the authored brief/);
  const tampered=structuredClone(selection);tampered.projections[0].observations[0].transfer='改成未授权的换脸目标。';assert.throws(()=>applyVisualPreferences(authored,tampered,{catalog}),/hash changed/);
  const rehashed=structuredClone(tampered);const {selection_sha256,...body}=rehashed;rehashed.selection_sha256=objectHash(body);assert.throws(()=>applyVisualPreferences(authored,rehashed,{catalog}),/selection or catalog changed/);
  const stale=fixture();stale.assets[0].observations[1].transfer='不同的发型目标。';assert.throws(()=>applyVisualPreferences(authored,selection,{catalog:stale}),/selection or catalog changed/);
  assert.throws(()=>applyVisualPreferences(authored,{...input(),projections:[]},{catalog}),/unsupported visual preference selection input/);
});

test('selection evidence and exact provenance freeze inside targets without claiming generated or approved pixels',()=>{
  const catalog=fixture(),applied=applyVisualPreferences(brief(),input(),{catalog}),snapshot=freezeProductionRun(applied,{run_id:'synthetic-visual-preference',case_id:'source-metadata',cohort:'test'});
  assert.doesNotThrow(()=>verifyFrozenRun(snapshot));assert.deepEqual(snapshot.actual_inputs,[]);
  const selection=snapshot.target.requirements.find(row=>row.visual_preference_selection).visual_preference_selection;
  assert.equal(selection.selection_sha256,applied.metadata.visual_preferences.selection_sha256);assert.equal(selection.catalog_sha256,objectHash(catalog));
  assert.equal(selection.projections[0].source.sha256,'1'.repeat(64));assert.deepEqual(selection.projections[0].source.source_records,['test-upload-VP-WARM']);assert.equal(selection.evidence.image_generated,false);assert.equal(selection.evidence.visual_quality_verified,false);assert.equal(selection.evidence.user_accepted,false);
  assert.ok(snapshot.target.acceptance.filter(row=>row.id.startsWith('VP:')).every(row=>!row.critical));
});

test('CLI supports inspect, select and apply without silent unknown filters or replacing existing output files',t=>{
  const dir=temporary(t),catalogPath=path.join(dir,'catalog.json'),inputPath=path.join(dir,'input.json'),briefPath=path.join(dir,'brief.json'),selectionPath=path.join(dir,'selection.json'),appliedPath=path.join(dir,'applied.json');
  fs.writeFileSync(catalogPath,JSON.stringify(fixture()));fs.writeFileSync(inputPath,JSON.stringify(input()));fs.writeFileSync(briefPath,JSON.stringify(brief()));
  const script=fileURLToPath(new URL('../scripts/visual-preferences.mjs',import.meta.url)),run=args=>spawnSync(process.execPath,[script,...args,'--catalog',catalogPath],{encoding:'utf8'});
  const queried=run(['list','--dimension','hair','--genre','科幻']);assert.equal(queried.status,0,queried.stderr);assert.deepEqual(JSON.parse(queried.stdout).map(row=>row.id),['VP-COOL']);
  assert.notEqual(run(['list','--dimenson','hair']).status,0);assert.notEqual(run(['list','--dimension','unknown']).status,0);
  const selected=run(['select','--input',inputPath,'--out',selectionPath]);assert.equal(selected.status,0,selected.stderr);assert.ok(JSON.parse(fs.readFileSync(selectionPath,'utf8')).selection_sha256);
  const applied=run(['apply','--brief',briefPath,'--input',selectionPath,'--out',appliedPath]);assert.equal(applied.status,0,applied.stderr);assert.ok(JSON.parse(fs.readFileSync(appliedPath,'utf8')).metadata.visual_preferences);
  assert.notEqual(run(['apply','--brief',briefPath,'--input',selectionPath,'--out',appliedPath]).status,0);
  assert.notEqual(run(['select','--input',inputPath,'--search','hair']).status,0);
});
