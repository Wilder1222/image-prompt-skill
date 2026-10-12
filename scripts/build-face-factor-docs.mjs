import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {faceControlCatalog} from './face-design.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const layers={structure:'稳定结构',soft_tissue:'软组织',surface_identity:'个体表面',expression:'当前表情',presentation:'呈现条件'};
const sides={global:'整体关系',midline:'中轴',bilateral:'人物自身左右'};
const views={front:'正面',three_quarter:'三分之二侧面',profile:'侧面'};
const clean=value=>String(value).replaceAll('|',' / ').replaceAll('\n',' ');

export function currentFaceFactorDocs(){
 const c=faceControlCatalog(),membership=new Set();
 if(new Set(c.group_order).size!==c.group_order.length||c.group_order.length!==Object.keys(c.groups).length||c.group_order.some(g=>!c.groups[g]))throw Error('invalid face group order');
 for(const [group,g] of Object.entries(c.groups))for(const axis of g.axes){if(membership.has(axis)||c.dimensions[axis]?.group!==group)throw Error('invalid group axis '+axis);membership.add(axis);}
 if(membership.size!==Object.keys(c.dimensions).length)throw Error('ungrouped face dimension');
 for(const [axis,d]of Object.entries(c.dimensions))if(!layers[d.layer]||!sides[d.laterality]||!d.channel||!Array.isArray(d.suggested_values)||!d.suggested_values.length||!Array.isArray(d.assessment_views)||d.assessment_views.some(v=>!views[v]))throw Error('invalid face metadata '+axis);
 for(const r of c.relationship_checks)if(!r.id||!r.question||!r.axes.length||r.axes.some(a=>!c.dimensions[a]))throw Error('invalid relationship '+r.id);
 const counts=Object.fromEntries(Object.keys(layers).map(l=>[l,Object.values(c.dimensions).filter(d=>d.layer===l).length]));
 return `# 人物面容完整因素目录\n\n由 \`node scripts/build-face-factor-docs.mjs\` 从权威JSON生成；不要手改下列派生列表。版本${c.version}，${c.group_order.length}组、${Object.keys(c.dimensions).length}项。\n\n本项目自建定性因素模型，参考游戏工作流而不复制游戏精确滑杆或编码；只选择本轮有效的参数，不自动填满。稳定结构${counts.structure}项、软组织${counts.soft_tissue}项、个体表面${counts.surface_identity}项、当前表情${counts.expression}项、呈现条件${counts.presentation}项。\n\n[选择与观察规则](../references/core/face-factor-system.md) · [官方调研与版本范围](game-face-system-research-2026-10-11.md) · [原始目录](../resources/face_design_catalog.json)\n\n\`catalog\`可查看全量定义；\`catalog --group philtrum\`只查询人中组。中文候选值只是可调起点，开放的value仍由当前人物与观察决定，没有通用默认数值。\n\n`
  +c.group_order.map(group=>{const g=c.groups[group];return `## ${g.label}\n\n| 字段 | 可观察/可设计因素 | 层 | 范围 | 描述起点 | 建议核对视角 |\n| --- | --- | --- | --- | --- | --- |\n`+g.axes.map(axis=>{const d=c.dimensions[axis];return `| ${axis} | ${clean(d.label)} | ${layers[d.layer]} | ${sides[d.laterality]} | ${d.suggested_values.map(clean).join('、')} | ${d.assessment_views.map(v=>views[v]).join('、')} |`;}).join('\n');}).join('\n\n')
  +'\n\n## 邻接关系复查\n\n复查不授权自动修改相邻部位，也不是程序已经确认形态协调。\n\n| 关系 | 涉及因素 | 实图/设计复查 |\n| --- | --- | --- |\n'
  +c.relationship_checks.map(r=>`| ${r.id} | ${r.axes.join('、')} | ${clean(r.question)} |`).join('\n')
  +'\n\n有原图时，局部可见、未知和获准设计分开。左右以人物自身为准，稳定结构进入签名，表情/妆肤/光线/取景不进入签名。目录与编译成功不证明实际美感、身份保持或精确三维控制。\n';
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 fs.writeFileSync(path.join(root,'docs/face-factor-catalog.md'),currentFaceFactorDocs());
 console.log('Generated complete face-factor documentation from the authoritative catalog.');
}
