import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compileAssetPrompt,createAssetPlan} from '../scripts/asset-master.mjs';
const cli=fileURLToPath(new URL('../scripts/iteration-director.mjs',import.meta.url));
const run=args=>spawnSync(process.execPath,[cli,'asset-prompt',...args],{encoding:'utf8'});
test('user-facing CLI defaults to Chinese tagged content, with explicit English compatibility',()=>{
 const r=run(['--format','text']);assert.equal(r.status,0,r.stderr);
 assert.equal(r.stdout.trim(),compileAssetPrompt({language:'zh-CN'}).prompt);
 assert.ok(r.stdout.trim().split('\n\n').every(x=>/^【P[012] [^】]+】/.test(x)));
 assert.doesNotMatch(r.stdout,/Create a|Preserve the|nine-head/);
 const en=run(['--language','en','--format','text']);assert.equal(en.status,0,en.stderr);assert.equal(en.stdout.trim(),compileAssetPrompt().prompt);
 assert.equal(run(['--language','fr']).status,1);
});
test('natural body proportions remain independent of presentation; P9 is opt-in',()=>{
 for(const presentation of ['neutral_asset','costume_showcase']){
  const p=createAssetPlan({presentation});assert.equal(p.configuration.proportion_profile,'NATURAL_ADULT');
  const text=compileAssetPrompt({presentation,language:'zh-CN'}).prompt;assert.match(text,/七至七点五/);assert.doesNotMatch(text,/八点六至九/);
  assert.doesNotMatch(compileAssetPrompt({presentation}).prompt,/Build a tall|naturally elevated waist|approximately nine-head/);
  const fashion=compileAssetPrompt({presentation,proportionProfile:'P9_FASHION_ASSET',language:'zh-CN'});assert.match(fashion.prompt,/八点六至九/);assert.doesNotMatch(fashion.prompt,/七至七点五/);
 }
 assert.equal(run(['--proportion-profile','typo']).status,1);
});
test('Chinese anchor and focused repairs preserve scope and accepted locks',()=>{
 const anchor=compileAssetPrompt({referenceMode:'full_body_anchor',language:'zh-CN'});assert.equal(anchor.configuration.proportion_profile,'preserve_reference');assert.doesNotMatch(anchor.prompt,/七至七点五/);
 assert.throws(()=>compileAssetPrompt({referenceMode:'full_body_anchor',proportionProfile:'NATURAL_ADULT',language:'zh-CN'}),/conflicting/);
 const hand=compileAssetPrompt({stage:'structure',focus:'hands',passed:['fashion_asset_proportion'],language:'zh-CN'});assert.match(hand.prompt,/仅修手部/);assert.doesNotMatch(hand.prompt,/七至七点五/);
 assert.throws(()=>compileAssetPrompt({stage:'structure',focus:'proportion',passed:['fashion_asset_proportion'],language:'zh-CN'}),/reopen passed/);
 const mat=compileAssetPrompt({stage:'material-light',focus:'materials',language:'zh-CN'});assert.match(mat.prompt,/灯位、背景和地面阴影保持/);assert.doesNotMatch(mat.prompt,/大面积柔和主光/);
});
