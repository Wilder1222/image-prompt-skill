import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt,objectHash} from './production-prompt.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultCatalogPath=path.join(root,'resources/visual_preference_catalog.json');
const dimensionChannels={face:'identity',expression:'expression',makeup:'makeup',hair:'hair',costume:'costume',material:'material',pose:'action',lighting:'lighting',palette:'style',composition:'composition',scene:'background',creature:'background',medium:'style'};
const contexts=new Set(['new_character','scene_creation','reference_preserve','portrait_standardization','costume_design','style_conversion']);
const media=new Set(['photographic','cg_precise','painterly','mixed','unknown']);
const feedbackStatuses=new Set(['provided_preference','accepted_aesthetic_example','rejected_sample']);
const productionChannels=new Set(['identity','expression','action','makeup','hair','costume','material','composition','layout','proportion','hands_feet','background','lighting','style','task','output']);
const standardizationBlocked=new Set(['lighting','palette','composition','pose','scene','creature','medium']);
const inputKeys=['id','context','selections'];
const selectionKeys=[...inputKeys,'schema_version','catalog_sha256','projections','excluded','evidence','selection_sha256'];
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const unique=values=>[...new Set(values)];

function keys(value,allowed,label){
  if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new Error(`invalid or unsupported ${label} fields`);
}
function strings(value,label,{empty=false}={}){
  if(!Array.isArray(value)||(!empty&&!value.length)||value.some(row=>!nonempty(row))||new Set(value).size!==value.length)throw new Error(`${label} needs unique nonempty strings`);
}
function relativeSource(value){
  return nonempty(value)&&!path.isAbsolute(value)&&!path.win32.isAbsolute(value)&&!path.posix.isAbsolute(value)&&!value.includes('\0');
}

// Metadata declarations are validated, not authenticated. This module does not
// open pixels or turn inspection/review labels into visual quality evidence.
export function validateVisualPreferenceCatalog(catalog){
  keys(catalog,['schema_version','source_images_bundled','dimensions','collections','assets'],'visual preference catalog');
  if(catalog.schema_version!==1||catalog.source_images_bundled!==false)throw new Error('visual preference catalog must use schema_version 1 and leave source images unbundled');
  keys(catalog.dimensions,Object.keys(dimensionChannels),'visual preference dimensions');
  if(Object.keys(catalog.dimensions).length!==Object.keys(dimensionChannels).length)throw new Error('visual preference catalog needs all thirteen dimensions');
  for(const [dimension,channel]of Object.entries(dimensionChannels)){
    const definition=catalog.dimensions[dimension];keys(definition,['label','production_channel'],`dimension ${dimension}`);
    if(!nonempty(definition.label)||definition.production_channel!==channel)throw new Error(`invalid production channel for ${dimension}`);
  }
  if(!plain(catalog.collections)||!Object.keys(catalog.collections).length)throw new Error('visual preference catalog needs named collections');
  for(const [id,collection]of Object.entries(catalog.collections)){
    if(!nonempty(id))throw new Error('collection needs an id');keys(collection,['label','description','contexts'],`collection ${id}`);
    if(!nonempty(collection.label)||!nonempty(collection.description))throw new Error(`collection ${id} needs a label and description`);
    strings(collection.contexts,`collection ${id} contexts`);
    if(collection.contexts.some(context=>!contexts.has(context)))throw new Error(`unknown collection context in ${id}`);
  }
  if(!Array.isArray(catalog.assets)||!catalog.assets.length)throw new Error('visual preference catalog needs assets');
  const ids=new Set(),aliases=new Set(),hashes=new Set();
  for(const asset of catalog.assets){
    keys(asset,['id','title','aliases','source','feedback','inspection','subjects','genres','medium','framing','collections','identity_preset_id','observations','limits'],'visual preference asset');
    if(!nonempty(asset.id)||ids.has(asset.id)||!nonempty(asset.title))throw new Error('missing or duplicate visual preference asset id');ids.add(asset.id);
  }
  for(const asset of catalog.assets){
    strings(asset.aliases,`asset ${asset.id} aliases`,{empty:true});
    for(const alias of asset.aliases){if(ids.has(alias)||aliases.has(alias))throw new Error(`conflicting visual preference alias ${alias}`);aliases.add(alias);}
    keys(asset.source,['sha256','local_path','availability','source_records'],`source ${asset.id}`);
    const source=asset.source;
    if((source.sha256!==null&&!digest(source.sha256))||(source.local_path!==null&&!relativeSource(source.local_path))||!['local_verified','historical_record','external_pointer'].includes(source.availability))throw new Error(`invalid visual preference source ${asset.id}`);
    strings(source.source_records,`asset ${asset.id} source records`);
    if(source.availability==='local_verified'&&(!digest(source.sha256)||!relativeSource(source.local_path)))throw new Error(`local_verified source ${asset.id} needs a digest and relative path`);
    if(source.sha256!==null){if(hashes.has(source.sha256))throw new Error(`duplicate exact SHA-256 source ${asset.id}; merge uploads and retain aliases`);hashes.add(source.sha256);}
    keys(asset.feedback,['status','scope','quote'],`feedback ${asset.id}`);
    if(!feedbackStatuses.has(asset.feedback.status)||asset.feedback.scope!=='whole_image'||(asset.feedback.quote!==null&&!nonempty(asset.feedback.quote)))throw new Error(`invalid feedback declaration ${asset.id}`);
    keys(asset.inspection,['status'],`inspection ${asset.id}`);
    if(!['actual_pixels','historical_pixels','record_only'].includes(asset.inspection.status))throw new Error(`invalid inspection declaration ${asset.id}`);
    strings(asset.subjects,`asset ${asset.id} subjects`,{empty:true});strings(asset.genres,`asset ${asset.id} genres`,{empty:true});
    strings(asset.collections,`asset ${asset.id} collections`);strings(asset.limits,`asset ${asset.id} limits`,{empty:true});
    if(asset.collections.some(id=>!Object.hasOwn(catalog.collections,id)))throw new Error(`unknown visual preference collection ${asset.id}`);
    if(!media.has(asset.medium)||!nonempty(asset.framing)||(asset.identity_preset_id!==null&&(!nonempty(asset.identity_preset_id)||!/^RP-[A-Za-z0-9._-]+$/.test(asset.identity_preset_id))))throw new Error(`invalid medium, framing or identity preset pointer ${asset.id}`);
    if(!Array.isArray(asset.observations))throw new Error(`asset ${asset.id} needs observations`);
    for(const observation of asset.observations){
      keys(observation,['dimension','visibility','text','transfer','limits','visual_limits'],`observation ${asset.id}`);
      if(!Object.hasOwn(dimensionChannels,observation.dimension)||!['visible','partial','unknown'].includes(observation.visibility)||!nonempty(observation.text)||typeof observation.transfer!=='string')throw new Error(`invalid visual preference observation ${asset.id}`);
      strings(observation.limits,`asset ${asset.id} observation limits`,{empty:true});
      if(observation.visual_limits!==undefined)strings(observation.visual_limits,`asset ${asset.id} visual limits`,{empty:true});
    }
  }
  return {valid:true,schema_version:1,asset_count:catalog.assets.length,hash_bound_asset_count:hashes.size,alias_count:aliases.size,source_images_bundled:false,
    evidence:{pixel_analysis_performed:false,visual_quality_verified:false,user_acceptance_authenticated:false}};
}

export function loadVisualPreferenceCatalog(catalogPath=defaultCatalogPath){
  if(!nonempty(catalogPath))throw new Error('catalog path must be a nonempty file path');
  const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));validateVisualPreferenceCatalog(catalog);return catalog;
}
function catalogOf(options,allowed=['catalog']){
  keys(options,allowed,'visual preference options');
  const catalog=options.catalog??loadVisualPreferenceCatalog();validateVisualPreferenceCatalog(catalog);return catalog;
}
function resolveFrom(assetId,catalog){
  if(!nonempty(assetId))throw new Error('visual preference asset id must be nonempty');
  const asset=catalog.assets.find(row=>row.id===assetId||row.aliases.includes(assetId));
  if(!asset)throw new Error(`unknown visual preference asset ${assetId}`);return structuredClone(asset);
}
export function resolveVisualPreference(assetId,options={}){return resolveFrom(assetId,catalogOf(options));}

export function listVisualPreferences(filters={},options={}){
  const catalog=catalogOf(options);keys(filters,['dimension','collection','genre','medium','search','include_rejected'],'visual preference filters');
  if(filters.dimension!==undefined&&!Object.hasOwn(dimensionChannels,filters.dimension))throw new Error(`unknown visual preference dimension ${filters.dimension}`);
  if(filters.collection!==undefined&&!Object.hasOwn(catalog.collections,filters.collection))throw new Error(`unknown visual preference collection ${filters.collection}`);
  if(filters.genre!==undefined&&(!nonempty(filters.genre)||!catalog.assets.some(row=>row.genres.includes(filters.genre))))throw new Error(`unknown visual preference genre ${filters.genre}`);
  if(filters.medium!==undefined&&!media.has(filters.medium))throw new Error(`unknown visual preference medium ${filters.medium}`);
  if(filters.search!==undefined&&!nonempty(filters.search))throw new Error('visual preference search must be nonempty');
  if(filters.include_rejected!==undefined&&typeof filters.include_rejected!=='boolean')throw new Error('include_rejected must be a boolean');
  const search=filters.search?.trim().toLocaleLowerCase();
  return structuredClone(catalog.assets.filter(asset=>(filters.include_rejected===true||asset.feedback.status!=='rejected_sample')&&
    (filters.dimension===undefined||asset.observations.some(row=>row.dimension===filters.dimension))&&
    (filters.collection===undefined||asset.collections.includes(filters.collection))&&
    (filters.genre===undefined||asset.genres.includes(filters.genre))&&
    (filters.medium===undefined||asset.medium===filters.medium)&&
    (search===undefined||JSON.stringify([asset.id,asset.title,asset.aliases,asset.subjects,asset.genres,asset.observations.map(row=>[row.text,row.transfer])]).toLocaleLowerCase().includes(search))));
}

export function buildVisualPreferenceSelection(input,options={}){
  const catalog=catalogOf(options);keys(input,inputKeys,'visual preference selection input');
  if(!nonempty(input.id)||!/^[A-Za-z0-9_-]+$/.test(input.id)||!contexts.has(input.context)||!Array.isArray(input.selections)||!input.selections.length)throw new Error('visual preference selection needs a stable id, supported context and selected assets');
  const selectedDimensions=new Map(),selectedAssets=new Set(),selections=[],projections=[],excluded=[];
  for(const entry of input.selections){
    keys(entry,['asset_id','dimensions'],'visual preference selection row');strings(entry.dimensions,'selected preference dimensions');
    const asset=resolveFrom(entry.asset_id,catalog);
    if(asset.feedback.status==='rejected_sample')throw new Error(`rejected sample ${asset.id} cannot be reused as a visual preference`);
    if(selectedAssets.has(asset.id))throw new Error(`duplicate canonical asset selection ${asset.id}; merge its selected dimensions`);selectedAssets.add(asset.id);
    if(!asset.collections.some(id=>catalog.collections[id].contexts.includes(input.context)))throw new Error(`asset ${asset.id} is unavailable for visual preference context ${input.context}`);
    for(const dimension of entry.dimensions){
      if(!Object.hasOwn(dimensionChannels,dimension))throw new Error(`unknown selected visual preference dimension ${dimension}`);
      if(selectedDimensions.has(dimension))throw new Error(`visual preference dimension ${dimension} already has a primary asset; do not combine conflicting main references`);selectedDimensions.set(dimension,asset.id);
      if(dimension==='face'&&input.context!=='new_character')throw new Error('face borrowing is allowed only for new_character, never an existing reference identity');
      if(input.context==='portrait_standardization'&&standardizationBlocked.has(dimension))throw new Error(`portrait_standardization cannot borrow ${dimension}; author an explicit changed test target separately`);
      const declared=asset.observations.filter(row=>row.dimension===dimension);
      if(!declared.length)throw new Error(`asset ${asset.id} has no declared observation for ${dimension}`);
      const usable=[];
      for(const observation of declared){
        const reason=asset.source.availability==='external_pointer'||asset.source.sha256===null?'unbound_source':asset.inspection.status==='record_only'?'record_only':observation.visibility==='unknown'?'unknown':!nonempty(observation.transfer)?'no_transfer':null;
        if(reason)excluded.push({asset_id:asset.id,dimension,reason,observation:structuredClone(observation)});
        else usable.push(structuredClone(observation));
      }
      if(usable.length)projections.push({asset_id:asset.id,dimension,label:catalog.dimensions[dimension].label,channel:dimensionChannels[dimension],
        observations:usable,visual_limits:unique(usable.flatMap(row=>row.visual_limits??[])),limits:unique([...asset.limits,...usable.flatMap(row=>row.limits)]),source:structuredClone(asset.source),feedback:structuredClone(asset.feedback),inspection:structuredClone(asset.inspection)});
    }
    selections.push({asset_id:asset.id,dimensions:[...entry.dimensions]});
  }
  if(!projections.length)throw new Error('selection has no reusable visible or partial observations bound to a real source digest; unknown, unbound and record-only entries remain records');
  const body={schema_version:1,id:input.id,context:input.context,selections,catalog_sha256:objectHash(catalog),projections,excluded,
    evidence:{image_generated:false,pixel_analysis_performed:false,visual_quality_verified:false,user_accepted:false,
      note:'Only declared provenance is validated. Feedback belongs to the source example and does not approve a new output.'}};
  return {...body,selection_sha256:objectHash(body)};
}

function rebuildSelection(inputOrSelection,catalog){
  if(!plain(inputOrSelection))throw new Error('visual preference selection must be an object');
  if(Object.hasOwn(inputOrSelection,'selection_sha256')){
    keys(inputOrSelection,selectionKeys,'built visual preference selection');
    const {selection_sha256,...body}=inputOrSelection;
    if(!digest(selection_sha256)||objectHash(body)!==selection_sha256)throw new Error('visual preference selection hash changed; rebuild from its authored selection');
    const rebuilt=buildVisualPreferenceSelection(Object.fromEntries(inputKeys.map(key=>[key,inputOrSelection[key]])),{catalog});
    if(rebuilt.selection_sha256!==selection_sha256)throw new Error('visual preference selection or catalog changed; rebuild and freeze the new target');return rebuilt;
  }
  return buildVisualPreferenceSelection(inputOrSelection,{catalog});
}

export function applyVisualPreferences(brief,inputOrSelection,options={}){
  const catalog=catalogOf(options,['catalog','allowed_edit_channels']);
  const alreadyApplied=typeof brief?.metadata?.visual_preferences!=='undefined'||(brief?.requirements??[]).some(row=>Object.hasOwn(row,'visual_preference_selection')||String(row.id).startsWith('VP:'))||
    (brief?.sections??[]).some(section=>section.items?.some(item=>item.basis?.some(id=>String(id).startsWith('VP:'))));
  if(alreadyApplied)throw new Error('brief already contains visual preferences; rebuild from the authored brief rather than stacking previous targets');
  compileProductionPrompt(brief);
  const selection=rebuildSelection(inputOrSelection,catalog);
  if((['new_character','portrait_standardization'].includes(selection.context)&&brief.subject_kind!=='character')||(selection.context==='scene_creation'&&!['scene','character'].includes(brief.subject_kind)))throw new Error('visual preference context conflicts with authored subject_kind');
  if(selection.projections.some(row=>row.dimension==='face')&&brief.references.some(ref=>ref.authority.includes('identity')))throw new Error('face preference cannot replace an existing identity reference or RP original');
  if(options.allowed_edit_channels!==undefined){strings(options.allowed_edit_channels,'allowed edit channels');if(options.allowed_edit_channels.some(channel=>!productionChannels.has(channel)))throw new Error('unknown allowed edit channel');}
  if(brief.edit_scope&&options.allowed_edit_channels===undefined)throw new Error('scoped edits require explicit allowed_edit_channels before applying visual preferences');
  if(options.allowed_edit_channels&&selection.projections.some(row=>!options.allowed_edit_channels.includes(row.channel)))throw new Error('visual preference escaped allowed edit channels, even when its priority is prefer');
  const next=structuredClone(brief),prefix=`VP:${selection.id}`;
  for(const [index,row]of selection.projections.entries()){
    const id=`${prefix}:${row.dimension}`,text=`在符合本轮明确目标与必须保持范围的前提下，可借鉴${row.label}：${row.observations.map(observation=>(observation.visibility==='partial'?'仅借鉴可见部分的表现，':'')+observation.transfer.trim()).join('；')}${row.visual_limits.length?`。借鉴边界：${row.visual_limits.map(limit=>limit.trim()).join('；')}`:''}`;
    if(next.requirements.some(requirement=>requirement.id===id)||next.acceptance.some(criterion=>criterion.id===`${id}:check`))throw new Error('visual preference projection id conflicts with existing targets');
    next.requirements.push({id,channel:row.channel,priority:'prefer',text,...(index===0?{visual_preference_selection:structuredClone(selection)}:{})});
    const label=`视觉偏好${row.label}`;
    if(next.sections.some(section=>section.label===label))throw new Error(`visual preference section label conflicts with existing authored section ${label}`);
    next.sections.push({label,channel:row.channel,items:[{text,basis:[id],intent:'constraint'}]});
    next.acceptance.push({id:`${id}:check`,basis:id,critical:false,question:`在本轮明确目标与获准范围内，${row.label}的借鉴是否有助于画面，且未覆盖必须目标或扩大修改范围？`});
  }
  next.metadata={...(next.metadata??{}),visual_preferences:{selection_sha256:selection.selection_sha256,context:selection.context,selections:structuredClone(selection.selections),
    priority:'prefer',critical:false,source_images_added:false,identity_authority_added:false,visual_quality_verified:false,user_accepted:false}};
  compileProductionPrompt(next);return next;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const command=process.argv[2],options={};
    for(let i=3;i<process.argv.length;i++){
      const key=process.argv[i];
      if(!['--catalog','--dimension','--collection','--genre','--medium','--search','--include-rejected','--input','--brief','--out','--allowed-edit-channels'].includes(key)||Object.hasOwn(options,key))throw new Error('invalid visual preference CLI options');
      if(key==='--include-rejected')options[key]=true;
      else {const value=process.argv[++i];if(!nonempty(value)||value.startsWith('--'))throw new Error(`missing CLI value ${key}`);options[key]=value;}
    }
    const allowed=command==='list'?['--catalog','--dimension','--collection','--genre','--medium','--search','--include-rejected','--out']:command==='select'?['--catalog','--input','--out']:command==='apply'?['--catalog','--input','--brief','--out','--allowed-edit-channels']:[];
    if(!allowed.length||Object.keys(options).some(key=>!allowed.includes(key))||(command!=='list'&&!options['--input'])||(command==='apply'&&!options['--brief']))throw new Error('usage: visual-preferences.mjs list [--dimension face] [--collection id] [--genre value] [--medium value] [--search text] [--include-rejected] | select --input selection.json | apply --brief brief.json --input selection.json [--allowed-edit-channels makeup,hair] [--out result.json]');
    const catalog=loadVisualPreferenceCatalog(options['--catalog']??defaultCatalogPath),read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
    const result=command==='list'?listVisualPreferences(Object.fromEntries(['dimension','collection','genre','medium','search','include_rejected'].filter(key=>options[`--${key.replaceAll('_','-')}`]!==undefined).map(key=>[key,options[`--${key.replaceAll('_','-')}`]])),{catalog}):
      command==='select'?buildVisualPreferenceSelection(read(options['--input']),{catalog}):applyVisualPreferences(read(options['--brief']),read(options['--input']),{catalog,...(options['--allowed-edit-channels']?{allowed_edit_channels:options['--allowed-edit-channels'].split(',')}:{})});
    if(options['--out']){const out=path.resolve(options['--out']);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
    else console.log(JSON.stringify(result,null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
