import fs from 'node:fs';
import {translateCatalogToEnglish, workflowEnglish} from './asset-catalog-en.mjs';

const workflows = JSON.parse(fs.readFileSync(new URL('../resources/asset_style_workflows.json', import.meta.url), 'utf8'));
export const characterStyleIds = Object.keys(workflows.profiles);

// Replace whole medium-dependent categories so an appended style clause cannot
// leave incompatible photographic skin, hair or fabric instructions underneath it.
export function applyCharacterAppearance(prompt, result, language) {
  const style = result.style_rendering;
  const appearance = style?.workflow.appearance;
  if (!appearance) return prompt;
  const en = language === 'en';
  const text = key => en ? translateCatalogToEnglish(appearance[key]) : appearance[key];
  const age = (style.age_guard?.prompt_translation ?? []).map(line => en ? translateCatalogToEnglish(line) : line).join(' ');
  const detail = en ? workflowEnglish.detail_budgets[result.configuration.detail_budget] : style.detail.zh;
  const highlight = en ? workflowEnglish.highlight_hierarchies[result.configuration.highlight_hierarchy] : style.highlights.zh;
  const edges = en ? workflowEnglish.edge_controls[result.configuration.edge_control] : style.edges.zh;
  const replacements = new Map();
  const set = (zh, english, value) => replacements.set(en ? english : zh, value);
  if (result.stage === 'generate') {
    set('任务与参考', 'Task and reference', en
      ? 'Create a single complete full-body character asset from the supplied reference and current design brief. Assign identity, costume and style sources explicitly; keep unobserved parts as declared design extensions. This compiler example uses a 3:4 white-background inspection view; actual production follows the requested scene, pose and framing.'
      : '依据实际参考与本轮设计生成单人完整全身人物资产，明确身份、衣装与风格来源，未见部位标为设计延展。本编译示例采用三比四白底检查图；实际生产按用户指定的场景、动作和取景编写。');
    // Conversion guidance belongs to generation, never a same-medium face repair.
    const conversion = appearance.face_conversion ? text('face_conversion') : '';
    set('人物身份与面容', 'Identity and face', [text('face'), conversion, age].filter(Boolean).join(' '));
    set('妆容与肌肤', 'Makeup and skin', text('makeup'));
    set('发型与头饰', 'Hair and ornaments', text('hair'));
    set('材质与服装真实感', 'Material response', `${text('material')} ${detail}`);
    set('背景与灯光', 'Background and light', `${text('lighting')} ${highlight} ${edges}`);
    set('最终目标', 'Final goal and restrictions', text('finish'));
  } else if (!en) {
    // Chinese scoped repairs are rendered separately from the planning skeleton.
    if (result.stage === 'face') set('面部表现', '', `${text('face')} ${text('makeup')} ${age}`.trim());
    if (result.stage === 'material-light') {
      if (result.focus !== 'lighting') set('既有材料', '', `${text('material')} ${detail}`);
      if (result.focus !== 'materials') set('棚拍光线', '', `${text('lighting')} ${highlight} ${edges}`);
    }
  }
  const rendered = prompt.split('\n\n').map(section => {
    const match = section.match(/^【([^】]+)】\n/);
    return match && replacements.has(match[1]) ? `【${match[1]}】\n${replacements.get(match[1])}` : section;
  }).join('\n\n');
  // This does not authorize a style conversion or reopen already accepted anatomy.
  const lock = en
    ? 'Retain the current image medium, identity, apparent age and accepted harmonious proportions. A local repair changes only the named area; choosing a style profile does not authorize restyling the whole image. Any unresolved proportion issue remains unresolved.'
    : '保留当前图像媒介、人物身份、表观年龄与已通过的协调修长比例；局部修复只改变指定区域，选择风格不授权整图换风格。未解决的比例问题仍保留为待修项。';
  return result.stage === 'generate' ? rendered : `${rendered}\n\n【${en ? 'Medium and scope' : '风格与范围'}】\n${lock}`;
}
