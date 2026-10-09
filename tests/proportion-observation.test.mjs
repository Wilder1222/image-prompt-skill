import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {proportionBounds,auditProportionObservation} from '../scripts/proportion-observation.mjs';
const sample=()=>({image_height:1536,crown_y:[25,45],chin_y:[210,230],sole_y:[1400,1445],landmark_note:'Synthetic bounds for arithmetic tests.',projection_note:'Synthetic common y-down axis; not anatomical evidence.'});

test('shared-crown bounds match exhaustive points and preserve affine scale',()=>{
 const a=sample(),r=proportionBounds(a),ratios=[];
 for(let c=25;c<=45;c++)for(let j=210;j<=230;j++)for(let s=1400;s<=1445;s++)ratios.push((s-c)/(j-c));
 assert.equal(r.ratio_lower,ratios.reduce((a,b)=>Math.min(a,b),Infinity));
 assert.equal(r.ratio_upper,ratios.reduce((a,b)=>Math.max(a,b),-Infinity));
 const b=structuredClone(a);b.image_height=4000;
 for(const key of ['crown_y','chin_y','sole_y'])b[key]=b[key].map(v=>2*v+17);
 const scaled=proportionBounds(b);
 assert.equal(scaled.ratio_lower,r.ratio_lower);assert.equal(scaled.ratio_upper,r.ratio_upper);
 // Independent body/head intervals spuriously mix two different crown positions.
 assert.notEqual(r.ratio_upper,(1445-25)/(210-45));
});
test('unknown sole minimum supports only an upper exclusion bound',()=>{
 const a=sample();a.sole_y=[null,1445];const r=proportionBounds(a);
 assert.equal(r.ratio_lower,null);assert.equal(r.ratio_upper,1400/165);
 assert.equal(r.target_relation,'excluded_by_declared_bounds');assert.equal(r.acceptance_granted,false);
});
test('containing nine, exact nine and ratios above nine never grant approval',()=>{
 for(const [chin,relation] of [[[90,110],'not_excluded_by_declared_bounds'],[[100,100],'not_excluded_by_declared_bounds'],[[80,80],'excluded_by_declared_bounds']]){
  const r=proportionBounds({...sample(),crown_y:[0,0],chin_y:chin,sole_y:[900,900]});
  assert.equal(r.target_relation,relation);assert.equal(r.status,'diagnostic_only');
  assert.equal(r.anatomical_measurement_verified,false);assert.equal(r.acceptance_granted,false);
 }
});
test('perspective exclusion is explicitly limited to image space, not the world-space body',()=>{
 // Fixed collinear world points: crown=1.8, chin=1.6, sole=0, hence nine heads.
 // Pinhole camera at height 1.3 and distance 3, aimed at height 0.9.
 // Rotation normalization cancels in Yc/Zc; focal length is 1800 pixels.
 const project=y=>1000-1800*(3*(y-1.3)+1.2)/(9-0.4*(y-1.3));
 const [c,j,s]=[1.8,1.6,0].map(project);
 const r=proportionBounds({...sample(),image_height:2000,crown_y:[c,c],chin_y:[j,j],sole_y:[s,s]});
 assert.ok(Math.abs(1.8/(1.8-1.6)-9)<1e-12);
 assert.ok(Math.abs(r.ratio_upper-8.394957983193277)<1e-12);
 assert.equal(r.target_relation,'excluded_by_declared_bounds');
 assert.equal(r.ratio_space,'image_projection');
 assert.equal(r.anatomical_target_relation,'not_established');
 assert.equal(r.anatomical_measurement_verified,false);
 assert.equal(r.acceptance_granted,false);
});
test('invalid or overlapping endpoint declarations cannot produce a ratio',()=>{
 for(const change of [{crown_y:[null,45]},{crown_y:[45,25]},{chin_y:[40,230]},{chin_y:[NaN,230]},{sole_y:[null,Infinity]},{sole_y:[200,1445]},{sole_y:[null,1600]},{projection_note:''},{image_height:1536.5}])assert.throws(()=>proportionBounds({...sample(),...change}));
});
test('file audit binds arithmetic to bytes and leaves files untouched',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'proportion-readonly-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const bytes=Buffer.from('synthetic file, not visual evidence'),file=path.join(dir,'fixture.bin');fs.writeFileSync(file,bytes);
 const a={...sample(),image:'fixture.bin',image_sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 const r=auditProportionObservation(a,dir);assert.equal(r.image,file);assert.deepEqual(fs.readFileSync(file),bytes);
 assert.throws(()=>auditProportionObservation({...a,image_sha256:'0'.repeat(64)},dir),/mismatch/);
 assert.equal(fs.readdirSync(dir).length,1);
});
