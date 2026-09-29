import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const tool=fileURLToPath(new URL('../scripts/iteration-director.mjs',import.meta.url));
const run=args=>spawnSync(process.execPath,[tool,...args],{cwd:root,encoding:'utf8'});

test('wardrobe reference cannot take identity, hair or body authority from the original',()=>{
 const r=run(['reference-authority','--scenario','identity_A_wardrobe_B']);
 assert.equal(r.status,0,r.stderr);
 const plan=JSON.parse(r.stdout);
 assert.equal(plan.A.role,'identity_source');
 assert.equal(plan.B.role,'wardrobe_design_reference');
 for(const channel of ['face_identity_geometry','apparent_age','expression','hair_color','hairstyle_silhouette']){
  assert.equal(plan.A.authority[channel],3,channel);
  assert.equal(plan.B.authority[channel],0,channel);
 }
 assert.equal(plan.A.authority.body_proportion,0,'a portrait does not establish unseen body proportions');
 assert.equal(plan.B.authority.body_proportion,0,'donor body cannot become subject identity');
 assert.equal(plan.B.authority.pose,0);
 assert.equal(plan.B.authority.background,0);
});

test('authorized wardrobe scenario assigns clothing to B with an explicit adaptation override',()=>{
 const plan=JSON.parse(run(['reference-authority','--scenario','identity_A_wardrobe_B']).stdout);
 for(const channel of ['garment_structure','garment_silhouette','palette_family']){
  assert.equal(plan.A.authority[channel],0,channel);
  assert.equal(plan.B.authority[channel],2,channel);
 }
 assert.match(plan.use_when,/user authorizes wardrobe redesign/);
 assert.match(plan.brief_precedence,/Explicit adaptation controls/);
 assert.match(plan.prompt_binding.join(' '),/explicit wardrobe adaptation takes precedence/i);
 assert.match(plan.review.join(' '),/actual generation input/);
});

test('cinematic style plan rejects wardrobe roles instead of emitting reversed identity instructions',()=>{
 const r=run(['style-intent-plan','--scenario','identity_A_wardrobe_B']);
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/wardrobe redesign scenario, not a style-restoration plan/);
 assert.equal(r.stdout.trim(),'');
});
