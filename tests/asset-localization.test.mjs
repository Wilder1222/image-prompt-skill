import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalogEnglish} from '../scripts/asset-catalog-en.mjs';
import {createAssetPlan,compileAssetPrompt} from '../scripts/asset-master.mjs';
import {inspectText} from '../scripts/audit-language.mjs';

test('English compatibility entries remain bound to current Chinese authority',()=>{
  for(const entry of catalogEnglish){
    const resource=JSON.parse(fs.readFileSync(new URL('../resources/'+entry.resource,import.meta.url),'utf8'));
    const value=entry.path.slice(2).replace(/\[(\d+)\]/g,'.$1').split('.').reduce((node,key)=>node?.[key],resource);
    assert.equal(value,entry.zh,entry.resource+entry.path);
    assert.doesNotMatch(entry.en,/[\u3400-\u9fff]/);
  }
});

test('current generated asset plans contain Chinese prose across supported profiles',()=>{
  for(const options of [{},{presentation:'costume_showcase',maturityGuard:'none'},{faceProfile:'humanized_real_full'},{styleWorkflow:'dark_fantasy_asset'}]){
    assert.deepEqual(inspectText('plan.json',JSON.stringify(createAssetPlan(options))),[]);
  }
});

test('explicit English remains complete across generation and scoped repairs',()=>{
  for(const options of [{},{referenceMode:'full_body_anchor'},{styleWorkflow:'dark_fantasy_asset'},{stage:'face'},{stage:'structure'},{stage:'material-light'},{stage:'structure',focus:'proportion'}]){
    const result=compileAssetPrompt({...options,language:'en'});
    assert.doesNotMatch(result.prompt,/[\u3400-\u9fff]/,JSON.stringify(options));
    assert.equal(result.status,'scaffold_only');
  }
});
