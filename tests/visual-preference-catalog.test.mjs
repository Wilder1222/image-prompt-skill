import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadVisualPreferenceCatalog,resolveVisualPreference,applyVisualPreferences} from '../scripts/visual-preferences.mjs';
import {compileProductionPrompt} from '../scripts/production-prompt.mjs';
const catalog=loadVisualPreferenceCatalog();
test('uploaded aesthetic references retain their role while original identities and exact duplicate aliases survive catalog import',()=>{
 const newSources=catalog.assets.filter(a=>a.id.startsWith('VP-C'));
 assert.equal(newSources.length,10);
 for(const row of newSources){assert.equal(row.identity_preset_id,null);assert.equal(row.feedback.scope,'whole_image');assert.equal(row.feedback.status,'provided_preference');}
 assert.equal(resolveVisualPreference('VP-A06').id,'VP-A02');
 assert.equal(resolveVisualPreference('user-aesthetic-01').id,'VP-B09');
 assert.equal(resolveVisualPreference('user-aesthetic-02').id,'VP-B10');
 const rp=JSON.parse(fs.readFileSync(new URL('../resources/reference_face_presets.json',import.meta.url),'utf8'));
 for(const row of catalog.assets.filter(a=>a.identity_preset_id!==null))assert.equal(row.source.sha256,rp.presets[row.identity_preset_id].source_sha256);
 assert.deepEqual(catalog.assets.filter(a=>a.feedback.status==='rejected_sample').map(a=>a.id),['VP-X02']);
 assert.equal(new Set(catalog.assets.map(a=>a.source.sha256).filter(Boolean)).size,catalog.assets.filter(a=>a.source.sha256!==null).length);
});
test('selecting one real reference dimension never adds its unselected creature, setting, ornament or prop',()=>{
 const base=JSON.parse(fs.readFileSync(new URL('../examples/face-design-portrait-base.json',import.meta.url),'utf8'));
 for(const [id,dimension,forbidden]of [['VP-C03','expression',/野兽|白狮/],['VP-C04','hair',/白狮|鬃毛/],['VP-C05','expression',/荷塘|坐姿/],['VP-C06','hair',/红花|金链/],['VP-C08','composition',/斜向杆|握持手|长柄/]]){
  const next=applyVisualPreferences(base,{id:`one-${id}-${dimension}`,context:'new_character',selections:[{asset_id:id,dimensions:[dimension]}]});
  const compiled=compileProductionPrompt(next);
  assert.doesNotMatch(compiled.prompt,forbidden);
  assert.deepEqual(next.references,base.references);
  assert.deepEqual(next.requirements.filter(r=>r.priority==='must'),base.requirements);
  assert.deepEqual(next.acceptance.filter(r=>r.critical),base.acceptance);
  assert.deepEqual(next.metadata.visual_preferences.selections,[{asset_id:id,dimensions:[dimension]}]);
 }
 // Keep the pixel observations, including full original object relationships,
 // rather than deleting evidence to make a narrow projection test pass.
 const raw=JSON.parse(fs.readFileSync(new URL('../docs/visual-preference-sources-2026-10-12.json',import.meta.url),'utf8'));
 for(const source of raw.new_reference_observations){
  const stored=resolveVisualPreference(source.id);
  assert.deepEqual(stored.observations.map(o=>({dimension:o.dimension,text:o.text})),source.observations.map(o=>({dimension:o.dimension,text:o.text})));
 }
});
