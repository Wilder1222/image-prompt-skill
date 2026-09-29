#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createAssetPlan, compileAssetPrompt} from './asset-master.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const ROLE=read('resources/reference_role_manifest.template.json');
const VIS=read('resources/visibility_map.template.json');
const ROUNDS=read('resources/repair_round_catalog.json');
const DIAG=read('resources/diagnostic_catalog.v07.json');
const MAT=read('resources/facial_maturity_catalog.json');
const OBS=read('resources/face_observation_catalog.json');
const REST=read('resources/restoration_reference_manifest.template.json');
const STYLE=read('resources/style_restoration_catalog.json');
const REAL=read('resources/reality_gain_catalog.json');
const RENDER=read('resources/render_mode_catalog.json');
const LIGHT=read('resources/lighting_reconstruction_catalog.json');
const MREAL=read('resources/material_realism_catalog.json');
const CONFLICT=read('resources/conflict_resolver_v2.json');
const FID=read('resources/reference_fidelity_catalog.json');
const COMP=read('resources/completion_level_catalog.json');
const HUMAN=read('resources/human_presence_catalog.json');
const DENS=read('resources/design_density_catalog.json');
const WEAR=read('resources/wear_state_catalog.json');
const COMPB=read('resources/completion_budget_catalog.json');
const DENSB=read('resources/design_density_budget_catalog.json');
const WEARB=read('resources/wear_budget_catalog.json');
const HUMAN2=read('resources/human_presence_v2_catalog.json');
const EXT=read('resources/extremity_integrity_catalog.json');
const PROP=read('resources/fashion_proportion_catalog.json');
const HUMAN21=read('resources/human_presence_v21_catalog.json');
const HUMAN3=read('resources/human_presence_v3_catalog.json');
const COHERENCE=read('resources/realism_coherence_catalog.json');
const FOCUS=read('resources/photographic_focus_catalog.json');
const HUMAN31=read('resources/human_presence_v31_catalog.json');
const EYE2=read('resources/eye_optics_v2_catalog.json');
const SKIN2=read('resources/skin_optical_variation_v2_catalog.json');
const SOFT2=read('resources/soft_tissue_v2_catalog.json');
const MAKEUP2=read('resources/makeup_skin_v2_catalog.json');
const HAIR2=read('resources/hair_frequency_v2_catalog.json');
const FOCUS2=read('resources/photographic_focus_v2_catalog.json');
const COHERENCE2=read('resources/realism_coherence_v2_catalog.json');
const P9P=read('resources/p9_persistence_guard_catalog.json');
const BODYP=read('resources/body_presence_catalog.json');
const FABWHITE=read('resources/photographic_fabric_white_catalog.json');
const FACE=read('resources/face_mode_catalog.json');
const MGUARD=read('resources/maturity_guard_catalog.json');
const RSCOPE=read('resources/realism_scope_catalog.json');
const FROUTE=read('resources/character_face_routing_catalog.json');
const SINTENT=read('resources/style_intent_router_catalog.json');
const STARGET=read('resources/style_target_profile_catalog.json');
const RAUTH=read('resources/reference_authority_matrix_catalog.json');
const SPGUARD=read('resources/style_preservation_guard_catalog.json');
const SFCOMPAT=read('resources/style_face_compatibility_catalog.json');
const DBUDGET=read('resources/detail_budget_v081_catalog.json');
const HHIER=read('resources/highlight_hierarchy_v081_catalog.json');
const BSUB=read('resources/background_submission_v081_catalog.json');
const PEDGE=read('resources/painterly_edge_v081_catalog.json');
const VHIER=read('resources/concept_art_hierarchy_v081_catalog.json');
const FACEP82=read('resources/face_profile_v082_catalog.json');
const FASSET82=read('resources/fashion_asset_v082_catalog.json');
const MATSEP82=read('resources/material_separation_v082_catalog.json');
const HAND82=read('resources/hand_pose_v082_catalog.json');
const ASSET82=read('resources/asset_master_v082_catalog.json');
const SLIGHT82=read('resources/studio_lighting_v082_catalog.json');
const APIPE82=read('resources/asset_master_pipeline_v082_catalog.json');
function argv(){const a=process.argv.slice(2),o={_:[]};for(let i=0;i<a.length;i++){if(a[i].startsWith('--')){const k=a[i].slice(2);o[k]=a[i+1]&&!a[i+1].startsWith('--')?a[++i]:true;}else o._.push(a[i]);}return o;}
const csv=v=>(v||'').split(',').map(x=>x.trim()).filter(Boolean);
function validate(){const e=[];const allowedVis=new Set(['visible','partially_visible','not_visible','unknown']);const allowedSource=new Set(['observed','inferred','designed_extension','user_locked']);
 for(const x of VIS.attributes){if(!allowedVis.has(x.visibility))e.push(`bad visibility ${x.name}`);if(!allowedSource.has(x.source))e.push(`bad source ${x.name}`);if(x.visibility==='not_visible'&&x.source==='observed')e.push(`not_visible cannot be observed: ${x.name}`);if(x.visibility==='not_visible'&&x.lock==='strict')e.push(`not_visible cannot strict lock: ${x.name}`);}
 const ids=new Set(ROLE.references.map(x=>x.id));if(ids.size!==ROLE.references.length)e.push('duplicate reference ids');
 if(!ROLE.identity_source||!ids.has(ROLE.identity_source))e.push('identity_source must point to an existing reference');
 const trait=ROLE.references.filter(x=>x.role==='facial_trait');if(trait.length!==1)e.push('template requires exactly one facial_trait reference');
 for(const t of trait){for(const banned of ['face_shape','eye_spacing','eye_shape_geometry','nose_proportion','lip_shape','jaw_chin'])if(!t.forbidden_authority.includes(banned))e.push(`facial_trait must forbid ${banned}`);}
 for(const [name,r] of Object.entries(ROUNDS.rounds)){const overlap=(r.editable||[]).filter(x=>(r.locked||[]).includes(x));if(overlap.length)e.push(`${name} editable/locked overlap ${overlap}`);}
 if(!MAT.levels['M2.5'])e.push('M2.5 maturity level missing');
 const restIds=new Set(REST.references.map(x=>x.id));if(restIds.size!==REST.references.length)e.push('duplicate restoration reference ids');
 const styleRef=REST.references.find(x=>x.role==='style_restoration');const assetRef=REST.references.find(x=>x.role==='asset_master');if(!styleRef||!assetRef)e.push('restoration manifest requires style_restoration and asset_master');
 for(const banned of ['face_identity_geometry','body_proportion','garment_silhouette','garment_structure'])if(styleRef&&!styleRef.forbidden_authority.includes(banned))e.push(`style_restoration must forbid ${banned}`);
 for(const id of ['S0','S1','S2','S3'])if(!STYLE.levels[id])e.push(`missing style level ${id}`);
 for(const id of ['R0','R1','R2','R3'])if(!REAL.levels[id])e.push(`missing reality level ${id}`);
 for(const id of ['asset','restoration','hybrid','style_asset'])if(!RENDER.modes[id])e.push(`missing render mode ${id}`);
 for(const c of ['identity','costume','material','pose','style','lighting','environment'])if(!FID.channels.includes(c))e.push(`missing fidelity channel ${c}`);
 for(const id of ['C0','C1','C2','C3'])if(!COMP.levels[id])e.push(`missing completion level ${id}`);
 for(const id of ['H0','H1','H2','H3'])if(!HUMAN.levels[id])e.push(`missing human presence level ${id}`);
 for(const id of ['low','medium','high'])if(!DENS.levels.includes(id))e.push(`missing density level ${id}`);
 for(const id of ['W0','W1','W2','W3','W4'])if(!WEAR.levels[id])e.push(`missing wear state ${id}`);
 for(const r of ['style_restoration','realism_merge','cinematic_polish','reference_fidelity','completion_guard','human_presence'])if(!ROUNDS.rounds[r])e.push(`missing round ${r}`);
 for(const id of ['C0','C1','C2','C3'])if(!COMPB.levels[id])e.push(`missing completion budget ${id}`);
 for(const id of ['preserve','reduce','enrich'])if(!DENSB.profiles[id])e.push(`missing density budget ${id}`);
 for(const id of ['W0','W1','W2','W3','W4'])if(!WEARB.levels[id])e.push(`missing wear budget ${id}`);
 for(const id of ['H0','H1','H2','H3'])if(!HUMAN2.levels[id])e.push(`missing human presence v2 level ${id}`);
 for(const id of ['E0','E1','E2','E3'])if(!EXT.levels[id])e.push(`missing extremity level ${id}`);
 for(const r of ['constraint_budget','extremity_integrity'])if(!ROUNDS.rounds[r])e.push(`missing round ${r}`);
 for(const id of ['P7','P8','P9','P9.5'])if(!PROP.levels[id])e.push(`missing fashion proportion ${id}`);
 for(const id of ['H0','H1','H2','H3'])if(!HUMAN21.levels[id])e.push(`missing human presence v2.1 ${id}`);
 for(const r of ['fashion_proportion','human_presence_refine'])if(!ROUNDS.rounds[r])e.push(`missing round ${r}`);
 for(const id of ['H0','H1','H2','H2.5','H3'])if(!HUMAN3.levels[id])e.push(`missing human presence v3 ${id}`);
 if(!ROUNDS.rounds['human_presence_optical_refine'])e.push('missing round human_presence_optical_refine');
 for(const c of ['eyes','skin','lips','brows_lashes','hair','makeup','adjacent_costume','camera_response'])if(!COHERENCE.channels.includes(c))e.push(`missing realism coherence channel ${c}`);
 for(const id of ['full_body_asset','half_body_asset','close_up_portrait'])if(!FOCUS.profiles[id])e.push(`missing focus profile ${id}`);
 for(const id of ['H2','H2.5','H2.7','H3'])if(!HUMAN31.levels[id])e.push(`missing human presence v3.1 ${id}`);
 if(!ROUNDS.rounds['human_face_optical_refine'])e.push('missing round human_face_optical_refine');
 if(!ROUNDS.rounds['human_camera_hair_refine'])e.push('missing round human_camera_hair_refine');
 for(const k of ['sclera_tone','iris_uniformity','eyelid_wrap','lash_root_integration'])if(EYE2.controls[k]===undefined)e.push(`missing eye v2 control ${k}`);
 for(const k of ['forehead','nose_bridge','nose_tip','nose_wing','inner_cheek','outer_cheek','eye_area','chin','lips'])if(!SKIN2.regions[k])e.push(`missing skin v2 region ${k}`);
 for(const k of ['cheek_volume','lower_lid_pad','nose_wing_softness','mouth_corner_volume'])if(SOFT2.controls[k]===undefined)e.push(`missing soft tissue v2 control ${k}`);
 if(MAKEUP2.controls.foundation_coverage!=='light')e.push('makeup v2 must keep foundation light');
 if((HAIR2.frequency_layers||[]).length!==3)e.push('hair v2 must contain three frequency layers');
 for(const id of ['portrait_priority','asset_balanced','full_detail'])if(!FOCUS2.profiles[id])e.push(`missing photographic focus v2 profile ${id}`);
 for(const c of ['eyes','skin','soft_tissue','makeup','hair','costume_material','lighting','camera_response'])if(!COHERENCE2.channels.includes(c))e.push(`missing realism coherence v2 channel ${c}`);
 for(const id of ['P8_locked','P9_locked','P9.5_locked'])if(!P9P.profiles[id])e.push(`missing P9 persistence profile ${id}`);
 for(const id of ['BP1','BP2','BP3'])if(!BODYP.levels[id])e.push(`missing body presence level ${id}`);
 if(!FABWHITE.profiles['white_asset_photographic'])e.push('missing photographic fabric white profile');
 for(const r of ['p9_persistence_body_presence','photographic_fabric_white_refine','final_photographic_polish'])if(!ROUNDS.rounds[r])e.push(`missing v0.7.8 round ${r}`);
 for(const id of ['beauty_first','humanized_real','stylized_beauty'])if(!FACE.modes[id])e.push(`missing face mode ${id}`);
 for(const id of ['youthful_18_22','young_adult_20_26','none'])if(!MGUARD.profiles[id])e.push(`missing maturity guard ${id}`);
 for(const id of ['beauty_first','humanized_real','stylized_beauty'])if(!RSCOPE.modes[id])e.push(`missing realism scope ${id}`);
 for(const id of ['ancient_ethereal_female','warrior_queen','cyber_oriental_female','stylized_poster_character'])if(!FROUTE.archetypes[id])e.push(`missing face route ${id}`);
 for(const id of ['asset_clean','style_target_match','cinematic_final','style_on_asset'])if(!SINTENT.intents[id])e.push(`missing style intent ${id}`);
 for(const id of ['oriental_epic_painterly','clean_asset_studio'])if(!STARGET.profiles[id])e.push(`missing style target profile ${id}`);
 if(!RAUTH.scenarios['style_A_asset_B'])e.push('missing style_A_asset_B authority scenario');
 if(!RAUTH.scenarios['identity_A_wardrobe_B'])e.push('missing identity_A_wardrobe_B authority scenario');
 for(const id of ['cinematic_target','style_asset_target'])if(!SPGUARD.profiles[id])e.push(`missing style preservation guard ${id}`);
 for(const id of ['oriental_epic_painterly','clean_asset_studio'])if(!SFCOMPAT.profiles[id])e.push(`missing style/face compatibility ${id}`);
 if(!RENDER.modes['cinematic_hybrid'])e.push('missing render mode cinematic_hybrid');
 for(const r of ['style_intent_alignment','style_target_restoration'])if(!ROUNDS.rounds[r])e.push(`missing v0.8.0 round ${r}`);
 for(const r of ['face_mode_calibration','non_face_realism_refine'])if(!ROUNDS.rounds[r])e.push(`missing v0.7.9 round ${r}`);
 for(const id of ['concept_art_priority','commercial_balanced'])if(!DBUDGET.profiles[id])e.push(`missing detail budget profile ${id}`);
 if(!HHIER.profiles['focal_brightness'])e.push('missing highlight hierarchy focal_brightness');
 if(!BSUB.profiles['monumental_subordinate'])e.push('missing background submission monumental_subordinate');
 if(!PEDGE.profiles['selective_painterly'])e.push('missing painterly edge selective_painterly');
 if(!VHIER.profiles['oriental_epic_concept'])e.push('missing concept art hierarchy oriental_epic_concept');
 if(!ROUNDS.rounds['concept_art_hierarchy_refine'])e.push('missing v0.8.1 round concept_art_hierarchy_refine');
 for(const id of ['beauty_first_clean','beauty_first_character','humanized_real_light','humanized_real_full','stylized_beauty'])if(!FACEP82.profiles[id])e.push(`missing v0.8.2 face profile ${id}`);
 if(!FASSET82.profiles['P9_FASHION_ASSET'])e.push('missing v0.8.2 P9_FASHION_ASSET');
 if(!MATSEP82.profiles['ancient_asset_material_split'])e.push('missing v0.8.2 material separation profile');
 if(!HAND82.modes['elegant_crossed_hands_safe'])e.push('missing v0.8.2 hand mode elegant_crossed_hands_safe');
 if(!ASSET82.profiles['master_sheet_single'])e.push('missing v0.8.2 asset master profile');
 if(!SLIGHT82.profiles['studio_soft_separation'])e.push('missing v0.8.2 studio lighting profile');
 if(!APIPE82.presets['ancient_female_white_master'])e.push('missing v0.8.2 asset pipeline preset');
 for(const r of ['asset_master_face_refine','asset_master_structure_refine','asset_master_material_light_refine'])if(!ROUNDS.rounds[r])e.push(`missing v0.8.2 round ${r}`);
 return {status:e.length?'fail':'pass',errors:e,references:ROLE.references.length,restoration_references:REST.references.length,rounds:Object.keys(ROUNDS.rounds).length,maturity_levels:Object.keys(MAT.levels).length,style_levels:Object.keys(STYLE.levels).length,reality_levels:Object.keys(REAL.levels).length,render_modes:4,render_modes_total:Object.keys(RENDER.modes).length,fidelity_presets:Object.keys(FID.presets).length,completion_levels:Object.keys(COMP.levels).length,human_presence_levels:Object.keys(HUMAN.levels).length,completion_budget_levels:Object.keys(COMPB.levels).length,density_budget_profiles:Object.keys(DENSB.profiles).length,wear_budget_levels:Object.keys(WEARB.levels).length,human_presence_v2_levels:Object.keys(HUMAN2.levels).length,extremity_levels:Object.keys(EXT.levels).length,fashion_proportion_levels:Object.keys(PROP.levels).length,human_presence_v21_levels:Object.keys(HUMAN21.levels).length,human_presence_v3_levels:Object.keys(HUMAN3.levels).length,realism_coherence_channels:COHERENCE.channels.length,focus_profiles:Object.keys(FOCUS.profiles).length,human_presence_v31_levels:Object.keys(HUMAN31.levels).length,skin_v2_regions:Object.keys(SKIN2.regions).length,hair_v2_frequency_layers:HAIR2.frequency_layers.length,focus_v2_profiles:Object.keys(FOCUS2.profiles).length,realism_coherence_v2_channels:COHERENCE2.channels.length,p9_persistence_profiles:Object.keys(P9P.profiles).length,body_presence_levels:Object.keys(BODYP.levels).length,photographic_fabric_profiles:Object.keys(FABWHITE.profiles).length,face_modes:Object.keys(FACE.modes).length,maturity_guard_profiles:Object.keys(MGUARD.profiles).length,realism_scope_modes:Object.keys(RSCOPE.modes).length,face_route_archetypes:Object.keys(FROUTE.archetypes).length,style_intents:Object.keys(SINTENT.intents).length,style_target_profiles:Object.keys(STARGET.profiles).length,reference_authority_scenarios:Object.keys(RAUTH.scenarios).length,style_preservation_guards:Object.keys(SPGUARD.profiles).length,detail_budget_profiles:Object.keys(DBUDGET.profiles).length,highlight_hierarchy_profiles:Object.keys(HHIER.profiles).length,background_submission_profiles:Object.keys(BSUB.profiles).length,painterly_edge_profiles:Object.keys(PEDGE.profiles).length,concept_art_hierarchy_profiles:Object.keys(VHIER.profiles).length,face_profiles_v082:Object.keys(FACEP82.profiles).length,fashion_asset_profiles_v082:Object.keys(FASSET82.profiles).length,material_separation_profiles_v082:Object.keys(MATSEP82.profiles).length,hand_modes_v082:Object.keys(HAND82.modes).length,asset_master_profiles_v082:Object.keys(ASSET82.profiles).length,studio_lighting_profiles_v082:Object.keys(SLIGHT82.profiles).length,asset_pipeline_presets_v082:Object.keys(APIPE82.presets).length};}
function roleReport(){return {identity_source:ROLE.identity_source,references:ROLE.references,optional_roles:ROLE.optional_roles,rule:'Identity geometry and facial traits are separate. facial_trait must never overwrite identity geometry.'};}
function visibilityReport(){return {reference_id:VIS.reference_id,attributes:VIS.attributes,strict_locks:VIS.attributes.filter(x=>x.lock==='strict').map(x=>x.name),extensions:VIS.attributes.filter(x=>x.source==='designed_extension').map(x=>x.name)};}
function roundPlan(name,passed=[]){const r=ROUNDS.rounds[name];if(!r)throw new Error(`unknown round ${name}`);const locked=[...new Set([...(r.locked||[]),...passed.filter(x=>!(r.editable||[]).includes(x))])];let strategy='short patch prompt; mention locked asset master once, expand editable dimensions only';
 if(name==='upscale')strategy='settings-first; no semantic redesign';
 else if(name==='trait_calibration')strategy='short trait patch; lock identity geometry; borrow only allowed traits';
 else if(name==='style_restoration')strategy='restore authorized style channels only; lock identity/body/garment architecture';
 else if(name==='realism_merge')strategy='apply reality gain to human/material behavior; preserve restored style channels';
 else if(name==='cinematic_polish')strategy='lighting/material highlight polish only; no semantic redesign';
 else if(name==='reference_fidelity')strategy='reassign reference channels and fidelity only; do not redesign image content';
 else if(name==='completion_guard')strategy='repair unseen-area extension, density and wear state only; preserve observed design';
 else if(name==='human_presence')strategy='soft tissue + regional skin + asymmetry + camera response; keep identity geometry locked';
 else if(name==='constraint_budget')strategy='translate completion/density/wear budgets into visible natural-language limits; no semantic redesign';
 else if(name==='extremity_integrity')strategy='local hand/foot anatomy patch only; lock passed identity, costume, composition and lighting';
 else if(name==='fashion_proportion')strategy='proportion-only patch: change whole-figure visual ratios and garment verticality while locking face identity, costume design, materials and lighting';
 else if(name==='human_presence_refine')strategy='human-presence-only patch: soft structure + micro-asymmetry + eye/hair/lens realism while locking identity, P9 proportion and costume';
 else if(name==='human_presence_optical_refine')strategy='optical-human patch: eyes + skin optics + makeup integration + hair frequency + camera/focus coherence while locking identity, P9 proportion, costume and lighting layout';
 else if(name==='human_face_optical_refine')strategy='face-optics-only patch: eye optics + regional young-skin response + soft tissue + lips + makeup integration while locking identity geometry, P9, hair design, costume, pose and light direction';
 else if(name==='human_camera_hair_refine')strategy='hair-camera-only patch: hair frequency hierarchy + hairline + focus hierarchy + highlight roll-off while locking approved face optics, skin, P9, costume and composition';
 else if(name==='p9_persistence_body_presence')strategy='preserve approved P9 proportions and add body-level human presence only; do not reopen face, costume or framing';
 else if(name==='photographic_fabric_white_refine')strategy='refine white-on-white separation, material-specific response and natural drape only; lock identity, P9 and costume architecture';
 else if(name==='final_photographic_polish')strategy='camera-response polish only after all semantic and material dimensions pass; no redesign';
 else if(name==='face_mode_calibration')strategy='face-mode-only calibration: protect identity and age impression, tune beauty/realism direction without changing body, costume or composition';
 else if(name==='non_face_realism_refine')strategy='non-face realism only: hair/body/hands/materials/cloth/footwear/lighting/camera; keep approved face mode, identity and maturity locked';
 else if(name==='style_intent_alignment')strategy='resolve explicit output/style intent first: choose render mode, background policy and style target authority without touching identity or costume architecture';
 else if(name==='style_target_restoration')strategy='restore target medium, motion, lighting, atmosphere and composition energy while keeping identity, costume architecture and approved face mode locked';
 else if(name==='concept_art_hierarchy_refine')strategy='concept-art hierarchy only: redistribute detail, brightness, background resolution and edge sharpness while locking style target, identity, face mode, motion, palette, costume architecture and composition energy';
 else if(name==='asset_master_face_refine')strategy='asset-face profile only: preserve identity geometry and age, increase character specificity without reopening body, costume, hands or lighting';
 else if(name==='asset_master_structure_refine')strategy='asset-structure only: strengthen P9 robe-aware read, master-sheet framing, hand integrity and footwear readability while locking approved face and costume design';
 else if(name==='asset_master_material_light_refine')strategy='asset material/light only: separate fabric layers, embroidery and gauze response, improve white-edge separation and grounded studio light while locking identity, proportion and framing';
 return {round:name,editable:r.editable,locked,forbidden:r.forbidden||[],prompt_strategy:strategy};}
function nextPlan(failures,passed){const rows=failures.map(id=>({id,...(DIAG.failures[id]||{})})).filter(x=>x.priority);const rank={P0:0,P0I:0.1,P0R:0.25,P0F:0.35,P0A:0.38,P0T:0.5,P1:1,P1E:1.05,P1P:1.08,P1B:1.1,P1C:1.15,P1S:1.2,P1M:1.25,P1A:1.28,P2:2,P2HA:2.01,P2HB:2.015,P2HV3:2.02,P2VH:2.03,P2H:2.05,P2S:2.1,P2R:2.2,P2AM:2.25,P3:3,P4:4};rows.sort((a,b)=>(rank[a.priority]??99)-(rank[b.priority]??99));const first=rows[0];if(!first)return {status:'no_known_failures'};let round=first.round==='current_round'?'identity_skin':first.round;return {first_focus:first.id,priority:first.priority,recommended_round:round,round_plan:ROUNDS.rounds[round]?roundPlan(round,passed):{round},failures:rows};}
function maturity(level){const m=MAT.levels[level||MAT.default_target];if(!m)throw new Error(`unknown maturity level ${level}`);return {level:level||MAT.default_target,...m,max_delta_per_round:MAT.max_delta_per_round,preferred_signals:MAT.preferred_signals,forbidden_for_light_maturity:MAT.forbidden_for_light_maturity};}
function traitPlan(level,passed=[]){const target=maturity(level);const r=roundPlan('trait_calibration',passed);return {target_maturity:target,reference_roles:{A:'asset_master + identity geometry',B:'facial_trait only'},round_plan:r,prompt_skeleton:['Image A is the Asset Master and identity geometry source.','Image B is only a Facial Trait Reference.','Keep A face shape, eye spacing/core geometry, nose proportions, lips and jaw/chin unchanged.',`Shift only facial presentation toward ${level||MAT.default_target}: steadier gaze, restrained expression, small cheek-softness reduction, slightly less wide-eyed openness, more editorial natural makeup.`,"Do not copy B's face geometry, hair, costume, body, background, lighting or camera framing."],note:'High-end is achieved primarily through presentation, not facial reshaping.'};}
function classifyFace(observations){const rows=observations.map(id=>({id,...(OBS.observations[id]||{})})).filter(x=>x.class);const labels=[];if(rows.some(x=>x.effect==='drift'))labels.push('identity_drift');else if(rows.some(x=>x.id==='face_geometry_stable'))labels.push('identity_stable');if(rows.some(x=>x.effect==='overborrow'))labels.push('trait_reference_overborrow');if(rows.some(x=>x.effect==='template_drift'))labels.push('beauty_template_drift');if(rows.some(x=>x.effect==='unwanted_shift'))labels.push('age_shift_unwanted');if(rows.some(x=>x.effect==='overshoot'))labels.push('maturity_overshoot');if(rows.some(x=>x.effect==='undershoot'))labels.push('maturity_undershoot');if(rows.some(x=>x.effect==='over_shift'))labels.push('temperament_shift_over');else if(rows.some(x=>x.effect==='target_shift'))labels.push('temperament_shift_target');return {observations:rows,classifications:[...new Set(labels)],recommended_next:labels.includes('identity_drift')?'identity_skin':labels.some(x=>['maturity_overshoot','maturity_undershoot','temperament_shift_over','trait_reference_overborrow','age_shift_unwanted'].includes(x))?'trait_calibration':'reclassify_or_lock'};}
function restorationRoles(){return {references:REST.references,optional_roles:REST.optional_roles,rule:'style_target controls authorized final visual-language channels; asset_master controls identity and structural continuity; explicit user output intent decides background/environment inheritance.'};}
function renderMode(name){const id=name||RENDER.default;const m=RENDER.modes[id];if(!m)throw new Error(`unknown render mode ${id}`);return {mode:id,...m};}
function styleLevel(name){const id=name||STYLE.default_intensity;const x=STYLE.levels[id];if(!x)throw new Error(`unknown style level ${id}`);return {level:id,...x,forbidden_borrow:STYLE.forbidden_borrow};}
function realityLevel(name){const id=name||REAL.default_target;const x=REAL.levels[id];if(!x)throw new Error(`unknown reality level ${id}`);return {level:id,...x,forbidden:REAL.forbidden};}
function stylePlan(mode='hybrid',style='S2',reality='R2'){
 const rm=renderMode(mode),sl=styleLevel(style),rl=realityLevel(reality);return {render_mode:rm,style_restoration:sl,reality_gain:rl,reference_roles:{A:'style_restoration only',B:'asset_master',C:'optional facial_trait only'},locks:['face_identity_geometry','body_proportion','garment_silhouette','garment_structure','signature_accessories'],lighting:LIGHT.hybrid_R2,material_layers:MREAL.layers,prompt_skeleton:['Assign reference roles first.',`Render mode: ${mode}. Style restoration: ${style}. Reality gain: ${reality}.`,'Keep asset identity/body/garment architecture locked.','Restore only authorized mood/motion/lighting/atmosphere/medium channels from the style reference.','Apply realism to human skin, hair, materials and lighting without erasing the restored fantasy language.'],note:'S/R levels are project heuristics, not vendor parameters.'};}
function fidelityPlan(name){const id=name||'single_reference_asset';const p=FID.presets[id];if(!p)throw new Error(`unknown fidelity preset ${id}`);return {preset:id,channels:Object.fromEntries(FID.channels.map(c=>[c,{level:p[c],label:FID.levels[String(p[c])]}])),rule:'one output attribute should have at most one strict source; these levels are project heuristics, not vendor parameters.'};}
function completionLevel(name){const id=name||COMP.default;const x=COMP.levels[id];if(!x)throw new Error(`unknown completion level ${id}`);return {level:id,...x,rule:'not-visible regions remain designed extensions, never observed facts.'};}
function humanPresence(name){const id=name||HUMAN.default;const x=HUMAN.levels[id];if(!x)throw new Error(`unknown human presence level ${id}`);return {level:id,...x,components:['soft_tissue','regional_skin_response','natural_asymmetry','camera_response'],rule:'human presence changes presentation, not identity geometry or age unless explicitly requested.'};}
function humanPresenceV2(name){const id=name||HUMAN2.default;const x=HUMAN2.levels[id];if(!x)throw new Error(`unknown human presence v2 level ${id}`);return {level:id,...x,regions:HUMAN2.region_rules,camera_rules:HUMAN2.camera_rules,components:['soft_tissue','regional_skin_response','natural_asymmetry','eye_anatomy','hair_irregularity','camera_response'],rule:'v2 human presence changes anatomy presentation and optics while identity geometry and age remain locked.'};}
function completionBudget(name){const id=name||COMPB.default;const x=COMPB.levels[id];if(!x)throw new Error(`unknown completion budget ${id}`);return {level:id,...x,rule:'budget percentages are internal heuristics; compile them into visible natural-language constraints.'};}
function densityBudget(name='preserve'){const x=DENSB.profiles[name];if(!x)throw new Error(`unknown density budget ${name}`);return {profile:name,...x,note:DENSB.note};}
function wearBudget(name){const id=name||WEARB.default;const x=WEARB.levels[id];if(!x)throw new Error(`unknown wear budget ${id}`);return {level:id,...x,rule:WEARB.prompt_translation_rule};}
function extremityGuard(level){const id=level||EXT.default;const x=EXT.levels[id];if(!x)throw new Error(`unknown extremity level ${id}`);return {level:id,...x,repair_policy:EXT.repair_policy};}
function constraintBudgetPlan(completion='C1',density='preserve',wear='W0',human='H2',extremity='E2'){return {completion:completionBudget(completion),design_density:densityBudget(density),wear:wearBudget(wear),human_presence:humanPresenceV2(human),extremity:extremityGuard(extremity),prompt_skeleton:[...completionBudget(completion).prompt_translation,...densityBudget(density).prompt_translation,`Preserve wear state ${wear}; do not increase stains, tears, fraying, or metal damage during completion.`,...((humanPresenceV2(human).prompt_translation)||[]),'When hands or feet are visible, verify anatomically correct extremities and repair them locally if needed.'],note:'Budgets are internal planning constraints and must be translated into normal visual language before prompting a vendor model.'};}
function densityPlan(level='medium',wear='W0'){if(!DENS.levels.includes(level))throw new Error(`unknown density level ${level}`);if(!WEAR.levels[wear])throw new Error(`unknown wear state ${wear}`);return {design_density:level,density_policy:DENS.default_policy,zones:DENS.zones,wear_state:{level:wear,label:WEAR.levels[wear]},rules:DENS.rules};}
function styleAssetPlan(preset='single_reference_style_asset',completion='C1',human='H2',density='medium',wear='W0'){const fid=fidelityPlan(preset),comp=completionLevel(completion),hp=humanPresence(human),dp=densityPlan(density,wear);return {render_mode:renderMode('style_asset'),reference_fidelity:fid,completion:comp,human_presence:hp,density:dp,constraint_budget:constraintBudgetPlan(completion,'preserve',wear,human,'E2'),prompt_skeleton:['Keep the reference identity and costume architecture as the primary asset source.','Use the reference style/material/lighting channels according to the fidelity matrix, but keep the background white or neutral.','Complete unseen lower-body or footwear regions conservatively; do not invent new primary motifs or increase design density.','Preserve the reference wear state instead of spreading damage into newly completed regions.','Increase human presence through soft tissue, regional skin response, eye anatomy, subtle asymmetry, hair irregularity and camera response without reshaping the face.','When hands or feet are visible, require anatomically correct extremities and use a local patch if a digit or foot error appears.'],note:'Style-on-Asset preserves reference flavor without copying the original environment; v0.7.4 adds explicit constraint budgets.'};}
function fashionProportion(level){const id=level||PROP.default;const x=PROP.levels[id];if(!x)throw new Error(`unknown fashion proportion ${id}`);return {level:id,...x,head_to_body_guard:PROP.head_to_body_guard,leg_segmentation_guard:PROP.leg_segmentation_guard,garment_proportion_assist:PROP.garment_proportion_assist,note:PROP.note};}
function proportionPlan(level='P9',passed=[]){const p=fashionProportion(level),r=roundPlan('fashion_proportion',passed);return {proportion:p,round_plan:r,prompt_skeleton:[...p.prompt_translation,...p.head_to_body_guard.rules,...p.leg_segmentation_guard.rules,...p.garment_proportion_assist.rules],note:'Use this as a narrow proportion patch. Do not reopen identity, costume design, materials, lighting or hand repairs.'};}
function humanPresenceV21(level){const id=level||HUMAN21.default;const x=HUMAN21.levels[id];if(!x)throw new Error(`unknown human presence v2.1 level ${id}`);return {level:id,...x,soft_structure_rules:HUMAN21.soft_structure_rules,micro_asymmetry_rules:HUMAN21.micro_asymmetry_rules,lens_response_rules:HUMAN21.lens_response_rules,principle:HUMAN21.principle};}
function humanRefinePlan(level='H2',passed=[]){const h=humanPresenceV21(level),r=roundPlan('human_presence_refine',passed);return {human_presence:h,round_plan:r,prompt_skeleton:[...(h.prompt_translation||[]),...h.soft_structure_rules,...h.micro_asymmetry_rules,...h.lens_response_rules],note:'Run only after fashion proportion is accepted when both are requested; lock P9 and identity before refining human presence.'};}
function fashionHumanPlan(proportion='P9',human='H2'){return {stage_1:proportionPlan(proportion),stage_2:humanRefinePlan(human,['fashion_proportion','body_proportion']),order:['fashion_proportion','human_presence_refine','studio_polish','upscale'],rule:'Solve proportion first, then human presence. Nine-head fashion proportion is not longer legs; human realism is not more pores.'};}
function humanPresenceV3(level){const id=level||HUMAN3.default;const x=HUMAN3.levels[id];if(!x)throw new Error(`unknown human presence v3 level ${id}`);return {level:id,...x,detail_budget:HUMAN3.detail_budget,forbidden_shortcuts:HUMAN3.forbidden_shortcuts,principle:HUMAN3.principle};}
function humanPresenceV31(level){const id=level||HUMAN31.default;const x=HUMAN31.levels[id];if(!x)throw new Error(`unknown human presence v3.1 level ${id}`);return {level:id,...x,forbidden_shortcuts:HUMAN31.forbidden_shortcuts,principle:HUMAN31.principle,prompt_translation:HUMAN31.prompt_translation};}
function eyeOpticsV2(){return {name:EYE2.name,controls:EYE2.controls,prompt_translation:EYE2.prompt_translation,forbidden:EYE2.forbidden};}
function skinOpticsV2(){return {name:SKIN2.name,age_policy:SKIN2.age_policy,regions:SKIN2.regions,prompt_translation:SKIN2.prompt_translation,forbidden:SKIN2.forbidden};}
function softTissueV2(){return {name:SOFT2.name,controls:SOFT2.controls,prompt_translation:SOFT2.prompt_translation,forbidden:SOFT2.forbidden};}
function makeupSkinV2(){return {name:MAKEUP2.name,controls:MAKEUP2.controls,prompt_translation:MAKEUP2.prompt_translation,forbidden:MAKEUP2.forbidden};}
function hairFrequencyV2(){return {name:HAIR2.name,controls:HAIR2.controls,frequency_layers:HAIR2.frequency_layers,prompt_translation:HAIR2.prompt_translation,forbidden:HAIR2.forbidden};}
function photographicFocusV2(profile='asset_balanced'){const x=FOCUS2.profiles[profile];if(!x)throw new Error(`unknown photographic focus v2 profile ${profile}`);return {profile,weights:x,rules:FOCUS2.rules,prompt_translation:FOCUS2.prompt_translation};}
function realismCoherenceV2(){return {channels:COHERENCE2.channels,rule:COHERENCE2.default_rule,repair_order:COHERENCE2.repair_order,failure_codes:COHERENCE2.failure_codes};}
function humanFacePlan(level='H2.7',passed=[]){const h=humanPresenceV31(level),r=roundPlan('human_face_optical_refine',passed),e=eyeOpticsV2(),sk=skinOpticsV2(),st=softTissueV2(),m=makeupSkinV2();return {human_presence:h,round_plan:r,eye_optics:e,skin_optics:sk,soft_tissue:st,makeup_skin:m,prompt_skeleton:['Use the current P9 Asset Master as the only direct edit target.','Keep identity geometry, P9 proportion, hair design, costume, pose, hands, footwear, background and light direction unchanged.',...e.prompt_translation,...sk.prompt_translation,...st.prompt_translation,...m.prompt_translation,'Change face optics and tissue presentation only; do not reopen hair, costume, body proportion or composition.'],note:'H2.7-A face-optics round. Lock the result before any hair/camera refinement.'};}
function humanCameraHairPlan(level='H2.7',profile='asset_balanced',passed=[]){const h=humanPresenceV31(level),r=roundPlan('human_camera_hair_refine',passed),ha=hairFrequencyV2(),f=photographicFocusV2(profile),c=realismCoherenceV2();return {human_presence:h,round_plan:r,hair_frequency:ha,focus:f,coherence:c,prompt_skeleton:['Use the approved H2.7-A face/skin result as the direct edit target.','Keep face geometry, approved eye optics, approved skin optics, P9 proportion, costume, pose and composition unchanged.',...ha.prompt_translation,...f.prompt_translation,'Keep eyes, skin, makeup, hair, costume materials, lighting and camera response within one coherent realism tier.','Change hair frequency and photographic focus/roll-off only; do not reopen face or body design.'],note:'H2.7-B hair/camera round. Run only after H2.7-A passes.'};}
function fashionHumanV31Plan(proportion='P9',human='H2.7'){return {stage_1:proportionPlan(proportion),stage_2:humanFacePlan(human,['fashion_proportion','body_proportion']),stage_3:humanCameraHairPlan(human,'asset_balanced',['fashion_proportion','body_proportion','human_face_optical_refine']),order:['fashion_proportion','human_face_optical_refine','human_camera_hair_refine','studio_polish','upscale'],rule:'Lock P9 first, solve face optics second, then hair/camera. Do not combine all photographic-human variables into one round.'};}
function realismCoherence(){return {channels:COHERENCE.channels,rule:COHERENCE.default_rule,repair_order:COHERENCE.repair_order,failure_codes:COHERENCE.failure_codes};}
function photographicFocus(profile='full_body_asset'){const x=FOCUS.profiles[profile];if(!x)throw new Error(`unknown focus profile ${profile}`);return {profile,...x};}
function humanOpticalPlan(level='H2.5',profile='full_body_asset',passed=[]){const h=humanPresenceV3(level),r=roundPlan('human_presence_optical_refine',passed),f=photographicFocus(profile),c=realismCoherence();return {human_presence:h,focus:f,coherence:c,round_plan:r,prompt_skeleton:[...(h.prompt_translation||[]),`Focus hierarchy: face/eyes strongest; upper costume crisp; full garment and footwear remain asset-readable; peripheral translucent edges may resolve slightly softer.`,'Preserve youthful skin color homogeneity; add realism through regional optical response, not random pigment noise.','Treat micro-asymmetry as optional: preserve naturally observed variation but do not deliberately deform a symmetrical face.'],note:'Run after P9 is accepted. This round does not reopen body proportion, identity geometry, costume architecture or lighting layout.'};}
function fashionHumanV3Plan(proportion='P9',human='H2.5'){return {stage_1:proportionPlan(proportion),stage_2:humanOpticalPlan(human,'full_body_asset',['fashion_proportion','body_proportion']),order:['fashion_proportion','human_presence_optical_refine','studio_polish','upscale'],rule:'Lock P9 first, then refine optical human presence. Realism is coherence, not maximum detail.'};}

function p9Persistence(profile='P9_locked'){const x=P9P.profiles[profile];if(!x)throw new Error(`unknown P9 persistence profile ${profile}`);return {profile,...x,principle:P9P.principle,failure_codes:P9P.failure_codes};}
function bodyPresence(level='BP2'){const x=BODYP.levels[level];if(!x)throw new Error(`unknown body presence level ${level}`);return {level,...x,principle:BODYP.principle,forbidden:BODYP.forbidden,failure_codes:BODYP.failure_codes};}
function photographicFabricWhite(profile='white_asset_photographic'){const x=FABWHITE.profiles[profile];if(!x)throw new Error(`unknown photographic fabric profile ${profile}`);return {profile,...x,principle:FABWHITE.principle,failure_codes:FABWHITE.failure_codes};}
function p9BodyPlan(profile='P9_locked',body='BP2',passed=[]){const p=p9Persistence(profile),b=bodyPresence(body),r=roundPlan('p9_persistence_body_presence',passed);return {p9_persistence:p,body_presence:b,round_plan:r,prompt_skeleton:[...(p.prompt_translation||[]),...(b.prompt_translation||[]),'Do not reopen face optics, costume architecture, pose, composition or lighting layout.'],note:'Use after P9 and face optics are approved. This round preserves proportion while extending human presence beyond the face.'};}
function fabricWhitePlan(profile='white_asset_photographic',passed=[]){const f=photographicFabricWhite(profile),r=roundPlan('photographic_fabric_white_refine',passed);return {fabric_white:f,round_plan:r,prompt_skeleton:[...(f.prompt_translation||[]),'Keep identity, approved P9, approved human presence, costume architecture, palette and composition locked.'],note:'White-on-white photographic refinement only. No dark outline and no costume redesign.'};}
function finalPhotographicPolishPlan(passed=[]){const r=roundPlan('final_photographic_polish',passed);return {round_plan:r,prompt_skeleton:['Keep every approved semantic design dimension locked.','Refine only local microcontrast, highlight roll-off, focus hierarchy, material-specific highlight balance, white-background tone and final camera response.','Do not use global sharpening, HDR clarity or extreme shallow depth of field.'],note:'Run only after P9 persistence, body presence and photographic fabric rounds pass.'};}
function fashionPersistencePipeline(){return {stage_1:p9BodyPlan('P9_locked','BP2',['fashion_proportion','human_face_optical_refine']),stage_2:fabricWhitePlan('white_asset_photographic',['fashion_proportion','human_face_optical_refine','p9_persistence_body_presence']),stage_3:finalPhotographicPolishPlan(['fashion_proportion','human_face_optical_refine','p9_persistence_body_presence','photographic_fabric_white_refine']),order:['p9_persistence_body_presence','photographic_fabric_white_refine','final_photographic_polish','upscale'],rule:'Do not reopen approved P9 or face optics. Extend realism from body to fabric to final camera response in separate rounds.'};}

function faceMode(mode='beauty_first'){const x=FACE.modes[mode];if(!x)throw new Error(`unknown face mode ${mode}`);return {mode,...x,principle:FACE.principle};}
function maturityGuard(profile='youthful_18_22'){const x=MGUARD.profiles[profile];if(!x)throw new Error(`unknown maturity guard ${profile}`);return {profile,...x,principle:MGUARD.principle};}
function realismSplit(mode='beauty_first'){const x=RSCOPE.modes[mode];if(!x)throw new Error(`unknown realism scope mode ${mode}`);return {mode,...x,non_face_channels:RSCOPE.non_face_channels,rule:RSCOPE.rule};}
function faceRoute(archetype='ancient_ethereal_female',override=null){const x=FROUTE.archetypes[archetype];if(!x)throw new Error(`unknown character archetype ${archetype}`);const mode=override||x.face_mode;return {archetype,auto_mode:x.face_mode,resolved_mode:mode,maturity_guard:x.maturity_guard,age_impression:x.age_impression,reason:x.reason,override_applied:Boolean(override),rule:FROUTE.rule};}
function faceModePlan(archetype='ancient_ethereal_female',override=null,passed=[]){const route=faceRoute(archetype,override),fm=faceMode(route.resolved_mode),mg=maturityGuard(route.maturity_guard),rs=realismSplit(route.resolved_mode),r=roundPlan('face_mode_calibration',passed);return {route,face_mode:fm,maturity_guard:mg,realism_scope:rs,round_plan:r,prompt_skeleton:[`Face mode: ${route.resolved_mode}.`,...(fm.prompt_translation||[]),...(mg.prompt_translation||[]),`Face realism scope: ${rs.face_realism}; non-face realism scope: ${rs.non_face_realism}.`,`Do not infer that stronger hair, fabric, body or lighting realism requires a more mature or more photoreal face.`],note:'Face beauty, age impression and realism intensity are routed separately from non-face realism.'};}
function nonFaceRealismPlan(mode='beauty_first',passed=[]){const rs=realismSplit(mode),r=roundPlan('non_face_realism_refine',passed);return {realism_scope:rs,round_plan:r,prompt_skeleton:[`Keep approved face mode ${mode}, identity geometry and age impression unchanged.`,`Apply ${rs.non_face_realism} realism to hair, body presence, hands, costume materials, cloth physics, footwear, lighting and camera response.`,`Do not increase facial maturity or facial realism just because non-face realism is high.`],note:'Use this round when the face is already aesthetically approved but materials/body/camera still look CG.'};}
function faceNonFacePlan(archetype='ancient_ethereal_female',override=null){const f=faceModePlan(archetype,override),n=nonFaceRealismPlan(f.route.resolved_mode,['face_mode','age_impression']);return {stage_1:f,stage_2:n,order:['face_mode_calibration','non_face_realism_refine','final_photographic_polish','upscale'],rule:'Choose the right face mode first; then improve non-face realism without reopening face maturity.'};}
function styleIntent(name='style_target_match',opts={}){const x=SINTENT.intents[name];if(!x)throw new Error(`unknown style intent ${name}`);const hasAsset=opts.hasAsset!==false,white=Boolean(opts.whiteBackground);let resolved;if(white&&name!=='asset_clean')resolved='style_asset';else if(x.render_mode)resolved=x.render_mode;else if(hasAsset&&x.render_mode_with_asset_master)resolved=x.render_mode_with_asset_master;else if(!hasAsset&&x.render_mode_without_asset_master)resolved=x.render_mode_without_asset_master;else if(hasAsset&&x.render_mode_with_style_ref)resolved=x.render_mode_with_style_ref;else resolved=x.render_mode_without_style_ref||RENDER.default;return {intent:name,...x,resolved_render_mode:resolved,precedence:SINTENT.precedence,rules:SINTENT.resolution_rules};}
function styleTargetProfile(name='oriental_epic_painterly'){const x=STARGET.profiles[name];if(!x)throw new Error(`unknown style target profile ${name}`);return {profile:name,...x};}
function referenceAuthority(name='style_A_asset_B'){const x=RAUTH.scenarios[name];if(!x)throw new Error(`unknown reference authority scenario ${name}`);return {scenario:name,...x,levels:RAUTH.levels,principle:RAUTH.principle};}
function stylePreservationGuard(name='cinematic_target'){const x=SPGUARD.profiles[name];if(!x)throw new Error(`unknown style preservation guard ${name}`);return {profile:name,...x};}
function styleFaceCompatibility(style='oriental_epic_painterly',explicitMode=null){const x=SFCOMPAT.profiles[style];if(!x)throw new Error(`unknown style compatibility profile ${style}`);const resolved=explicitMode||x.recommended;if(!x.allowed.includes(resolved))throw new Error(`face mode ${resolved} is not allowed for style ${style}`);return {style_profile:style,recommended:x.recommended,resolved_face_mode:resolved,override_applied:Boolean(explicitMode),reason:x.reason,allowed:x.allowed,principle:SFCOMPAT.principle};}
function styleIntentPlan(intent='style_target_match',style='oriental_epic_painterly',scenario='style_A_asset_B',face=null,white=false){
 if(scenario==='identity_A_wardrobe_B')throw new Error('identity_A_wardrobe_B is a wardrobe redesign scenario, not a style-restoration plan; use reference-authority and the character asset workflow');
 const si=styleIntent(intent,{hasAsset:scenario==='style_A_asset_B',whiteBackground:white}),sp=styleTargetProfile(style),ra=referenceAuthority(scenario),fc=styleFaceCompatibility(style,face),guard=stylePreservationGuard(si.resolved_render_mode==='style_asset'?'style_asset_target':'cinematic_target'),r=roundPlan('style_intent_alignment',[]);return {style_intent:si,style_target:sp,reference_authority:ra,face_compatibility:fc,preservation_guard:guard,round_plan:r,prompt_skeleton:[`Render mode: ${si.resolved_render_mode}.`,`Image A is the Style Target; Image B is the Asset Master.`,`Keep B identity and garment architecture; borrow A medium, motion, lighting, atmosphere and composition energy only.`,`Face mode: ${fc.resolved_face_mode}.`,white?'Keep the explicit white/neutral background while applying style language only.':'Do not inherit the Asset Master white background; follow the cinematic style target environment/presentation.','Do not flatten painterly motion/atmosphere during realism refinement.'],note:'Explicit style intent and background constraints are resolved before archetype defaults.'};}
function detailBudget(profile='concept_art_priority'){const x=DBUDGET.profiles[profile];if(!x)throw new Error(`unknown detail budget profile ${profile}`);return {profile,...x};}
function highlightHierarchy(profile='focal_brightness'){const x=HHIER.profiles[profile];if(!x)throw new Error(`unknown highlight hierarchy profile ${profile}`);return {profile,...x};}
function backgroundSubmission(profile='monumental_subordinate'){const x=BSUB.profiles[profile];if(!x)throw new Error(`unknown background submission profile ${profile}`);return {profile,...x};}
function painterlyEdge(profile='selective_painterly'){const x=PEDGE.profiles[profile];if(!x)throw new Error(`unknown painterly edge profile ${profile}`);return {profile,...x};}
function conceptArtHierarchy(profile='oriental_epic_concept'){const x=VHIER.profiles[profile];if(!x)throw new Error(`unknown concept art hierarchy profile ${profile}`);return {profile,...x};}
function conceptArtHierarchyPlan(profile='oriental_epic_concept',passed=[]){const h=conceptArtHierarchy(profile),d=detailBudget(h.detail_budget),hi=highlightHierarchy(h.highlight_hierarchy),b=backgroundSubmission(h.background_submission),e=painterlyEdge(h.edge_control),r=roundPlan('concept_art_hierarchy_refine',passed);return {hierarchy:h,detail_budget:d,highlight_hierarchy:hi,background_submission:b,painterly_edge:e,round_plan:r,prompt_skeleton:['Keep the approved oriental epic painterly style, black-white-gold-crimson palette, beauty-first/stylized-beauty face direction, full-body epic composition and large-scale motion unchanged.','Concentrate highest detail on face, crown, chest-neck focal area, waist core ornament and weapon core.','Keep main garment masses, primary sleeves and major hair volumes at medium detail.','Let hair tails, outer ribbons, distant architecture, mist, clouds, ground reflections and peripheral effects remain selectively resolved and more impressionistic.','Use the strongest highlights near the face/crown/upper torso/weapon core; keep secondary garment highlights lower and peripheral/background light subordinate.','Keep monumental background scale but lower architectural resolution and contrast around the face and upper-body focal zone.','Use crisp edges only at focal structures; soften or partially lose edges in hair tails, drifting cloth, haze and distant architecture.','Do not redesign identity, costume, palette, motion language or composition energy.'],note:'Use after style target direction is approved. This round reduces over-completion without weakening the cinematic style target.'};}
function blackRedV081Plan(face='beauty_first'){const style=blackRedImage4Plan(face);const hierarchy=conceptArtHierarchyPlan('oriental_epic_concept',['style_intent_alignment','style_target_restoration']);return {style_stage:style,hierarchy_stage:hierarchy,order:['style_intent_alignment','style_target_restoration','concept_art_hierarchy_refine'],rule:'First restore the target style; then redistribute detail, highlights, background emphasis and edge sharpness without reopening identity or style intent.'};}
function blackRedImage4Plan(face=null){return styleIntentPlan('style_target_match','oriental_epic_painterly','style_A_asset_B',face,false);}
function faceProfileV082(id='beauty_first_character'){const x=FACEP82.profiles[id];if(!x)throw new Error(`unknown v0.8.2 face profile ${id}`);return {profile:id,...x,principle:FACEP82.principle};}
function fashionAssetV082(id='P9_FASHION_ASSET'){const x=FASSET82.profiles[id];if(!x)throw new Error(`unknown v0.8.2 fashion asset profile ${id}`);return {profile:id,...x,principle:FASSET82.principle};}
function materialSeparationV082(id='ancient_asset_material_split'){const x=MATSEP82.profiles[id];if(!x)throw new Error(`unknown v0.8.2 material separation profile ${id}`);return {profile:id,...x,principle:MATSEP82.principle};}
function handPoseV082(id='elegant_crossed_hands_safe'){const x=HAND82.modes[id];if(!x)throw new Error(`unknown v0.8.2 hand mode ${id}`);return {mode:id,...x,principle:HAND82.principle};}
function assetMasterV082(id='master_sheet_single'){const x=ASSET82.profiles[id];if(!x)throw new Error(`unknown v0.8.2 asset master profile ${id}`);return {profile:id,...x};}
function studioLightingV082(id='studio_soft_separation'){const x=SLIGHT82.profiles[id];if(!x)throw new Error(`unknown v0.8.2 studio lighting profile ${id}`);return {profile:id,...x};}
function assetMasterPlanV082(preset='ancient_female_white_master',passed=[],options={}){return createAssetPlan({preset,passed,...options});}
function ancientWhiteAssetPromptPlanV082(options={}){
 const plan=createAssetPlan(options), compiled=compileAssetPrompt(options);
 return {plan,prompt_skeleton:compiled.prompt.split('\n\n'),prompt:compiled.prompt,evidence:compiled.evidence};
}
function assetOptions(o,extra=[]){
 const allowed=new Set(['_','preset','face-profile','hand-mode','maturity-guard','presentation','design-freedom','passed',...extra]);
 for(const key of Object.keys(o))if(!allowed.has(key))throw new Error(`unknown asset option --${key}`);
 for(const [key,value] of Object.entries(o))if(key!=='_'&&typeof value!=='string')throw new Error(`--${key} requires a value`);
 if(o._.length!==1)throw new Error('asset commands accept named options only');
 return {preset:o.preset,faceProfile:o['face-profile'],handMode:o['hand-mode'],maturityGuard:o['maturity-guard'],presentation:o.presentation,designFreedom:o['design-freedom'],passed:csv(o.passed)};
}
function conflictCheck(keys){const found=[];for(const id of keys){const row=CONFLICT.conflicts[id];if(row)found.push({id,...row});}return {conflicts:found,priority_order:CONFLICT.priority_order,status:found.length?'needs_resolution':'clear'};}
const o=argv();try{const cmd=o._[0];let out;
 if(cmd==='validate')out=validate();
 else if(cmd==='roles')out=roleReport();
 else if(cmd==='restoration-roles')out=restorationRoles();
 else if(cmd==='visibility')out=visibilityReport();
 else if(cmd==='round')out=roundPlan(o.name||o._[1],csv(o.passed));
 else if(cmd==='next')out=nextPlan(csv(o.failures),csv(o.passed));
 else if(cmd==='maturity')out=maturity(o.level||o._[1]);
 else if(cmd==='trait-plan')out=traitPlan(o.level||MAT.default_target,csv(o.passed));
 else if(cmd==='classify-face')out=classifyFace(csv(o.observations));
 else if(cmd==='render-mode')out=renderMode(o.name||o._[1]);
 else if(cmd==='style-level')out=styleLevel(o.level||o._[1]);
 else if(cmd==='reality-level')out=realityLevel(o.level||o._[1]);
 else if(cmd==='style-plan')out=stylePlan(o.mode||'hybrid',o.style||'S2',o.reality||'R2');
 else if(cmd==='fidelity-plan')out=fidelityPlan(o.preset||o._[1]);
 else if(cmd==='completion-level')out=completionLevel(o.level||o._[1]);
 else if(cmd==='human-presence')out=humanPresence(o.level||o._[1]);
 else if(cmd==='human-presence-v2')out=humanPresenceV2(o.level||o._[1]);
 else if(cmd==='completion-budget')out=completionBudget(o.level||o._[1]);
 else if(cmd==='density-budget')out=densityBudget(o.profile||o._[1]||'preserve');
 else if(cmd==='wear-budget')out=wearBudget(o.level||o._[1]);
 else if(cmd==='extremity-guard')out=extremityGuard(o.level||o._[1]);
 else if(cmd==='proportion-profile')out=fashionProportion(o.level||o._[1]||'P9');
 else if(cmd==='proportion-plan')out=proportionPlan(o.level||o._[1]||'P9',csv(o.passed));
 else if(cmd==='human-presence-v21')out=humanPresenceV21(o.level||o._[1]||'H2');
 else if(cmd==='human-refine-plan')out=humanRefinePlan(o.level||o._[1]||'H2',csv(o.passed));
 else if(cmd==='fashion-human-plan')out=fashionHumanPlan(o.proportion||'P9',o.human||'H2');
 else if(cmd==='human-presence-v3')out=humanPresenceV3(o.level||o._[1]||'H2.5');
 else if(cmd==='realism-coherence')out=realismCoherence();
 else if(cmd==='photographic-focus')out=photographicFocus(o.profile||o._[1]||'full_body_asset');
 else if(cmd==='human-optical-plan')out=humanOpticalPlan(o.level||'H2.5',o.profile||'full_body_asset',csv(o.passed));
 else if(cmd==='fashion-human-v3-plan')out=fashionHumanV3Plan(o.proportion||'P9',o.human||'H2.5');
 else if(cmd==='human-presence-v31')out=humanPresenceV31(o.level||o._[1]||'H2.7');
 else if(cmd==='eye-optics-v2')out=eyeOpticsV2();
 else if(cmd==='skin-optics-v2')out=skinOpticsV2();
 else if(cmd==='soft-tissue-v2')out=softTissueV2();
 else if(cmd==='makeup-skin-v2')out=makeupSkinV2();
 else if(cmd==='hair-frequency-v2')out=hairFrequencyV2();
 else if(cmd==='photographic-focus-v2')out=photographicFocusV2(o.profile||o._[1]||'asset_balanced');
 else if(cmd==='realism-coherence-v2')out=realismCoherenceV2();
 else if(cmd==='human-face-plan')out=humanFacePlan(o.level||'H2.7',csv(o.passed));
 else if(cmd==='human-camera-hair-plan')out=humanCameraHairPlan(o.level||'H2.7',o.profile||'asset_balanced',csv(o.passed));
 else if(cmd==='fashion-human-v31-plan')out=fashionHumanV31Plan(o.proportion||'P9',o.human||'H2.7');
 else if(cmd==='p9-persistence')out=p9Persistence(o.profile||o._[1]||'P9_locked');
 else if(cmd==='body-presence')out=bodyPresence(o.level||o._[1]||'BP2');
 else if(cmd==='photographic-fabric-white')out=photographicFabricWhite(o.profile||o._[1]||'white_asset_photographic');
 else if(cmd==='p9-body-plan')out=p9BodyPlan(o.profile||'P9_locked',o.body||'BP2',csv(o.passed));
 else if(cmd==='fabric-white-plan')out=fabricWhitePlan(o.profile||'white_asset_photographic',csv(o.passed));
 else if(cmd==='final-photographic-polish-plan')out=finalPhotographicPolishPlan(csv(o.passed));
 else if(cmd==='fashion-persistence-pipeline')out=fashionPersistencePipeline();
 else if(cmd==='face-mode')out=faceMode(o.mode||o._[1]||'beauty_first');
 else if(cmd==='maturity-guard')out=maturityGuard(o.profile||o._[1]||'youthful_18_22');
 else if(cmd==='realism-split')out=realismSplit(o.mode||o._[1]||'beauty_first');
 else if(cmd==='face-route')out=faceRoute(o.archetype||o._[1]||'ancient_ethereal_female',o.mode||null);
 else if(cmd==='face-mode-plan')out=faceModePlan(o.archetype||'ancient_ethereal_female',o.mode||null,csv(o.passed));
 else if(cmd==='non-face-realism-plan')out=nonFaceRealismPlan(o.mode||'beauty_first',csv(o.passed));
 else if(cmd==='face-nonface-plan')out=faceNonFacePlan(o.archetype||'ancient_ethereal_female',o.mode||null);
 else if(cmd==='style-intent')out=styleIntent(o.intent||o._[1]||'style_target_match',{hasAsset:o.asset!=='false',whiteBackground:o.white==='true'||o.white===true});
 else if(cmd==='style-target-profile')out=styleTargetProfile(o.profile||o._[1]||'oriental_epic_painterly');
 else if(cmd==='reference-authority')out=referenceAuthority(o.scenario||o._[1]||'style_A_asset_B');
 else if(cmd==='style-preservation-guard')out=stylePreservationGuard(o.profile||o._[1]||'cinematic_target');
 else if(cmd==='style-face-compatibility')out=styleFaceCompatibility(o.style||'oriental_epic_painterly',o.mode||null);
 else if(cmd==='style-intent-plan')out=styleIntentPlan(o.intent||'style_target_match',o.style||'oriental_epic_painterly',o.scenario||'style_A_asset_B',o.mode||null,o.white==='true'||o.white===true);
 else if(cmd==='detail-budget-v081')out=detailBudget(o.profile||o._[1]||'concept_art_priority');
 else if(cmd==='highlight-hierarchy-v081')out=highlightHierarchy(o.profile||o._[1]||'focal_brightness');
 else if(cmd==='background-submission-v081')out=backgroundSubmission(o.profile||o._[1]||'monumental_subordinate');
 else if(cmd==='painterly-edge-v081')out=painterlyEdge(o.profile||o._[1]||'selective_painterly');
 else if(cmd==='concept-art-hierarchy')out=conceptArtHierarchy(o.profile||o._[1]||'oriental_epic_concept');
 else if(cmd==='concept-art-hierarchy-plan')out=conceptArtHierarchyPlan(o.profile||'oriental_epic_concept',csv(o.passed));
 else if(cmd==='black-red-v081-plan')out=blackRedV081Plan(o.mode||'beauty_first');
 else if(cmd==='black-red-image4-plan')out=blackRedImage4Plan(o.mode||null);
 else if(cmd==='face-profile-v082')out=faceProfileV082(o.profile||o._[1]||'beauty_first_character');
 else if(cmd==='fashion-asset-v082')out=fashionAssetV082(o.profile||o._[1]||'P9_FASHION_ASSET');
 else if(cmd==='material-separation-v082')out=materialSeparationV082(o.profile||o._[1]||'ancient_asset_material_split');
 else if(cmd==='hand-pose-v082')out=handPoseV082(o.mode||o._[1]||'elegant_crossed_hands_safe');
 else if(cmd==='asset-master-v082')out=assetMasterV082(o.profile||o._[1]||'master_sheet_single');
 else if(cmd==='studio-light-v082')out=studioLightingV082(o.profile||o._[1]||'studio_soft_separation');
 else if(cmd==='asset-master-plan-v082')out=createAssetPlan(assetOptions(o));
 else if(cmd==='ancient-white-asset-plan-v082')out=ancientWhiteAssetPromptPlanV082(assetOptions(o));
 else if(cmd==='asset-prompt'){
  const options=assetOptions(o,['stage','focus','format','reference-mode']);
  if(o.format&&!['text','json'].includes(o.format))throw new Error('format must be text or json');
  out=compileAssetPrompt({...options,stage:o.stage,focus:o.focus,referenceMode:o['reference-mode']});
 }
 else if(cmd==='constraint-plan')out=constraintBudgetPlan(o.completion||'C1',o.density||'preserve',o.wear||'W0',o.human||'H2',o.extremity||'E2');
 else if(cmd==='density-plan')out=densityPlan(o.level||'medium',o.wear||'W0');
 else if(cmd==='style-asset-plan')out=styleAssetPlan(o.preset||'single_reference_style_asset',o.completion||'C1',o.human||'H2',o.density||'medium',o.wear||'W0');
 else if(cmd==='conflict-check')out=conflictCheck(csv(o.conflicts));
 else throw new Error('commands: asset-prompt --stage generate|face|structure|material-light --face-profile ... --focus hands|proportion|framing|materials|lighting --format text|json | validate | roles | restoration-roles | visibility | round --name ... | next --failures ... | maturity --level M2.5 | trait-plan --level M2.5 | classify-face --observations ... | render-mode --name hybrid | style-level --level S2 | reality-level --level R2 | style-plan --mode hybrid --style S2 --reality R2 | fidelity-plan --preset single_reference_asset | completion-level --level C1 | human-presence --level H2 | human-presence-v2 --level H2 | completion-budget --level C1 | density-budget --profile preserve | wear-budget --level W2 | extremity-guard --level E2 | proportion-profile --level P9 | proportion-plan --level P9 | human-presence-v21 --level H2 | human-refine-plan --level H2 | fashion-human-plan --proportion P9 --human H2 | human-presence-v3 --level H2.5 | realism-coherence | photographic-focus --profile full_body_asset | human-optical-plan --level H2.5 --profile full_body_asset | fashion-human-v3-plan --proportion P9 --human H2.5 | human-presence-v31 --level H2.7 | eye-optics-v2 | skin-optics-v2 | soft-tissue-v2 | makeup-skin-v2 | hair-frequency-v2 | photographic-focus-v2 --profile asset_balanced | realism-coherence-v2 | human-face-plan --level H2.7 | human-camera-hair-plan --level H2.7 --profile asset_balanced | fashion-human-v31-plan --proportion P9 --human H2.7 | p9-persistence --profile P9_locked | body-presence --level BP2 | photographic-fabric-white --profile white_asset_photographic | p9-body-plan --profile P9_locked --body BP2 | fabric-white-plan --profile white_asset_photographic | final-photographic-polish-plan | fashion-persistence-pipeline | face-mode --mode beauty_first | maturity-guard --profile youthful_18_22 | realism-split --mode beauty_first | face-route --archetype ancient_ethereal_female | face-mode-plan --archetype ancient_ethereal_female | non-face-realism-plan --mode beauty_first | face-nonface-plan --archetype ancient_ethereal_female | style-intent --intent style_target_match | style-target-profile --profile oriental_epic_painterly | reference-authority --scenario style_A_asset_B | style-preservation-guard --profile cinematic_target | style-face-compatibility --style oriental_epic_painterly | style-intent-plan --intent style_target_match --style oriental_epic_painterly | black-red-image4-plan | face-profile-v082 --profile beauty_first_character | fashion-asset-v082 --profile P9_FASHION_ASSET | material-separation-v082 | hand-pose-v082 | asset-master-v082 | studio-light-v082 | asset-master-plan-v082 | ancient-white-asset-plan-v082 | detail-budget-v081 --profile concept_art_priority | highlight-hierarchy-v081 --profile focal_brightness | background-submission-v081 --profile monumental_subordinate | painterly-edge-v081 --profile selective_painterly | concept-art-hierarchy --profile oriental_epic_concept | concept-art-hierarchy-plan | black-red-v081-plan | constraint-plan --completion C1 --density preserve --wear W2 --human H2 --extremity E2 | density-plan --level medium --wear W2 | style-asset-plan --preset single_reference_style_asset --completion C1 --human H2 --density medium --wear W2 | conflict-check --conflicts ...');
 console.log(cmd==='asset-prompt'&&o.format==='text'?out.prompt:JSON.stringify(out,null,2));process.exitCode=out.status==='fail'?1:0;
}catch(e){console.error(JSON.stringify({status:'fail',error:e.message},null,2));process.exitCode=1;}
