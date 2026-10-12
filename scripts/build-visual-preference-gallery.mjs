import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadVisualPreferenceCatalog} from './visual-preferences.mjs';
import {promptHash} from './production-prompt.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function buildVisualPreferenceGallery(outputDirectory='output/visual-preference-library-20261012'){
 const directory=path.resolve(root,outputDirectory),relative=path.relative(path.join(root,'output'),directory);
 if(relative.startsWith('..')||path.isAbsolute(relative)||relative==='')throw Error('gallery must be built in a child directory of project output');
 const catalog=loadVisualPreferenceCatalog(),missing=[];let verified=0;
 for(const asset of catalog.assets){
  if(!asset.source.local_path)continue;
  const file=path.resolve(root,asset.source.local_path);
  if(!fs.existsSync(file)){missing.push(asset.id);asset.source.local_path=null;asset.source.availability='historical_record';continue;}
  if(promptHash(fs.readFileSync(file))!==asset.source.sha256)throw Error(`original content changed: ${asset.id}`);
  verified++;
 }
 fs.mkdirSync(directory,{recursive:true});
 fs.copyFileSync(path.join(root,'assets/visual-preference-library.html'),path.join(directory,'gallery.html'));
 fs.writeFileSync(path.join(directory,'library.json'),JSON.stringify(catalog,null,2)+'\n');
 const report={catalog_assets:catalog.assets.length,verified_local_originals:verified,missing_local_originals:missing,original_images_modified:false,generated_image_count:0};
 fs.writeFileSync(path.join(directory,'gallery-build.json'),JSON.stringify(report,null,2)+'\n');return {directory,...report};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length>3)throw Error('usage: build-visual-preference-gallery.mjs [output/child-directory]');console.log(JSON.stringify(buildVisualPreferenceGallery(process.argv[2]),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
