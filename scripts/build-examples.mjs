import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileAssetPrompt, createAssetPlan } from './asset-master.mjs';
import { applyFaceDesign, reviseFaceDesign } from './face-design.mjs';
import { compileProductionPrompt } from './production-prompt.mjs';
import { buildPortraitLookPlan, renderPortraitLookPrompts } from './portrait-look-plan.mjs';

export function currentExamples() {
  const cases = [
    ['A：角色感优先的全身白底生成', {}],
    ['东方幻想原画资产：保留厚涂面容与选择性边缘', { styleWorkflow: 'dark_fantasy_asset', maturityGuard: 'none' }],
    ['B：轻度真人感；其余条件与 A 相同', { faceProfile: 'humanized_real_light' }],
    ['服装定妆展示：有层次的长袍与袖摆', { presentation: 'costume_showcase', maturityGuard: 'none' }],
    ['适度优化服装与造型：保留人物辨识度，按方案再设计', { presentation: 'costume_showcase', maturityGuard: 'none', designFreedom: 'moderate' }],
    ['已有全身参考：保留身份、造型与已认可体型比例', { referenceMode: 'full_body_anchor' }],
    ['只修手部，锁定已通过的比例与构图', { stage: 'structure', focus: 'hands', passed: ['fashion_asset_proportion', 'asset_framing'] }],
    ['只修材质，保持脸、姿态与灯光', { stage: 'material-light', focus: 'materials' }],
    ['只修灯光与白纱边缘分离', { stage: 'material-light', focus: 'lighting' }],
  ];
  return '# 当前白底角色资产测试提示词\n\n'
    + '由 `npm run examples:build` 自动生成。A/B 使用同一张参考图、相同画幅与模型设置，只改变面部渲染方向；不要将 A 的输出作为 B 的输入。局部编辑使用最新已接受母图。\n\n'
    + '以下是通用编译示例，仍需填写本套服装的具体构造和参考权限。展示型仅适合用户需要的流动长袍；全身母图模式保留自身造型。这些示例本身没有对应生成图，实际回归另存输入输出回执。\n\n'
    + cases.map(([title, options]) => `## ${title}\n\n\`\`\`text\n${compileAssetPrompt({...options, language:'zh-CN'}).prompt}\n\`\`\`\n`).join('\n');
}

export function currentCharacterStyleExamples() {
  const workflows=JSON.parse(fs.readFileSync(new URL('../resources/asset_style_workflows.json',import.meta.url),'utf8'));
  return '# 当前人物风格编译示例\n\n由 `npm run examples:build` 从风格目录生成。以下为兼容编译素材，不是已观察具体人物后完成的生产提示词，也没有对应的逐风格实图验收。实际人物、衣装、动作和背景按当前任务编写；所有人物任务先适配年龄与指定体型，未指定时默认适度美化为黄金比例审美下轻盈修长的仙侠身形，覆盖各题材、媒介和生成编辑流程；已达标体型保持连续，未达标另建美化版本，明确限定的局部操作仍保持本步骤边界；按构图保留适当留白。\n\n'
    + Object.entries(workflows.profiles).filter(([,p])=>p.appearance).map(([styleWorkflow,p])=>`## ${p.label}\n\n\`\`\`text\n${compileAssetPrompt({styleWorkflow}).prompt}\n\`\`\`\n`).join('\n');
}

export function currentFaceDesignExamples() {
  const read = name => JSON.parse(fs.readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
  const original = read('face-design-original.json');
  const smile = reviseFaceDesign(original, read('face-design-expression-change.json'));
  return '# 人物捏脸系统完整提示词示例\n\n'
    + '由 `npm run examples:build` 从独立面容方案与肖像 brief 生成。两例共用同一套面容结构，只修改神态；它们是原创文字设计，尚未生成图像，不能据此判断身份保持或美感。\n\n'
    + [['原创药师：安静专注', original], ['同一面容：轻轻微笑', smile]].map(([title, face]) => {
      const brief = applyFaceDesign(read('face-design-portrait-base.json'), face);
      const compiled = compileProductionPrompt(brief);
      return `## ${title}\n\n\`\`\`text\n${compiled.prompt}\n\`\`\`\n`;
    }).join('\n');
}

export function currentBlueBenchmarkDistinctFacesExamples() {
  const read = name => JSON.parse(fs.readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
  const set = read('blue-benchmark-distinct-faces-set.json');
  const cases = set.cases.map(row => [row.label, read(row.file), read(set.portrait_base)]);
  const original = read('face-design-original.json');
  const revised = reviseFaceDesign(original, read(set.presentation_change));
  cases.push(['既有药师：保留原来结构与年龄，仅提升妆肤和神态', revised, read('face-design-portrait-base.json')]);
  return '# 共用审美完成度与不同面容的完整提示词\n\n'
    + '由 `npm run examples:build` 从独立面容方案编译。蓝衣长发肖像是审美示例之一，迁移妆肤与神态的完成度；这些人物的脸型、骨相和眉眼鼻唇关系为原创设计，不复制示例的脸、蓝衣或长发。前三例共用妆肤、神态、发型、衣装和照明，结构区别须由各自面容承担。\n\n'
    + '这是文字设计演练，没有新出图、逐人用户接受或跨模型证据；编译与冻结检查不证明图像中的美感、身份保持或人物区分。最后一例在既有药师面容上只修订妆肤和神态。\n\n'
    + cases.map(([title, face, base]) => {
      const brief = applyFaceDesign(base, face);
      const compiled = compileProductionPrompt(brief);
      return `## ${title}\n\n\`\`\`text\n${compiled.prompt}\n\`\`\`\n`;
    }).join('\n');
}

export function currentFaceControlExamples() {
  const read = name => JSON.parse(fs.readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
  const sided = read('face-design-sided-original.json');
  const changed = reviseFaceDesign(sided, read('face-design-left-eye-change.json'));
  return '# 全面细部与左右局部设计示例\n\n由 `npm run examples:build` 生成。目录有205项可选因素，正文只使用本例选定的因素；以下是未生成像素的原创设计，不是游戏滑杆执行、参考复刻或人物质量证据。三十五岁女性、衣领与灰底均属于具体示例，不是系统默认。\n\n'
    + [['细部文士：人中、眉眼与鼻唇连接',read('face-design-full-detail.json')],['左右独立：自然轻微差异',sided],['授权变体：仅修改人物自身左眼',changed]].map(([title,face]) => {
      const brief = applyFaceDesign(read('face-design-portrait-base.json'),face);
      return `## ${title}\n\n\`\`\`text\n${compileProductionPrompt(brief).prompt}\n\`\`\`\n`;
    }).join('\n');
}

export function currentPortraitMakeupStudioExamples() {
  const set = JSON.parse(fs.readFileSync(new URL('../examples/portrait-makeup-studio-set.json', import.meta.url), 'utf8'));
  return '# 妆肤、白底棚光与定妆取景示例\n\n'
    + '历史方法演练：本页保留分部位妆面与取景写法，不作为当前自由选色的默认方案。新设妆肤与光线请按[用户八图基准](../references/routes/reference-makeup-lighting.md)选择主卡，使用[当前八套示例](reference-makeup-lighting-current-prompts.md)。\n\n'
    + '由 `npm run examples:build` 从 [原创方案](portrait-makeup-studio-set.json) 编译。方法来自对“生成白底资产图”对话与四张原始设定板截图的分析，未取得该对话后续近景生成结果。这里只迁移妆面描述、受光与清晰度关系和取景方法，不复刻其人物身份、妆容或造型。\n\n'
    + '三例分别采用不同年龄、肤色、面容、妆量与光泽，都是独立的原创文字设计，不构成统一人物预设或同人连续资产；也不是证明某个提示词已改善出图的对照实验。摄影与精细CG分别明确，其他媒介按本轮要求调整。来源记录、完整 brief 和生成前关键验收均保留于原创方案。\n\n'
    + '以下完整正文可分别复制。尚未生成图像、验证视觉质量或获得用户接受；正文编译与计划检查只验证声明。\n\n'
    + set.cases.map(row => {
      const compiled = compileProductionPrompt(row.brief);
      const checks = row.brief.acceptance.filter(c => /-(?:makeup|composition|background|lighting)-check$|-(?:detail-clarity|skin-color)$/.test(c.id));
      return `## ${row.label}\n\n${row.scope}\n\n\`\`\`text\n${compiled.prompt}\n\`\`\`\n\n`
        + '生成后重点核对：\n\n' + checks.map(c => `- ${c.question}`).join('\n') + '\n';
    }).join('\n');
}

export function currentPortraitLookExamples() {
  const input = JSON.parse(fs.readFileSync(new URL('../examples/portrait-look-diversity-plan.json', import.meta.url), 'utf8'));
  const report = buildPortraitLookPlan(input);
  return '# 同一原创人物的多造型完整提示词\n\n'
    + '由 `npm run examples:build` 从 [造型方案](portrait-look-diversity-plan.json) 编译。[来源分析与优化方案](../docs/portrait-look-diversity-analysis-2026-10-15.md)仅用于提炼方法；这里另行原创人物，不复刻附件面容，不把旧拼板作为身份输入。\n\n'
    + '本例按来源场景演示十套、日韩风五套与中国风五套；这些是设计分组，不是人物族群、专属起源或2026流行榜单，实际任务的数量与分组另定。每套继承同一身份、正脸端正头位、自然乌黑发色、取景、身材和布光，分别选择脸前结构、妆面及可见表演。\n\n'
    + '这是文字设计演练。声明查重与编译通过不证明实际造型差异、本人保持、适配、流行度或用户接受，尚未生成新图。以下每套正文独立完整，可分别复制；真实参考任务仍须绑定并实际提供自己的身份原图。\n\n'
    + renderPortraitLookPrompts(report);
}

const surfaceCatalog = () => JSON.parse(fs.readFileSync(new URL('../resources/portrait_surface_reference_catalog.json', import.meta.url), 'utf8'));
const surfaceSources = () => JSON.parse(fs.readFileSync(new URL('../docs/makeup-lighting-reference-sources-2026-10-19.json', import.meta.url), 'utf8'));

export function referenceMakeupLightingBriefs() {
  const base = JSON.parse(fs.readFileSync(new URL('../examples/portrait-makeup-studio-set.json', import.meta.url), 'utf8')).cases[0].brief;
  const sources = surfaceSources();
  return surfaceCatalog().cards.map(card => {
    const source = sources.source_images.find(row => row.id === card.id);
    if (!source?.inspected || !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error(`missing inspected source for ${card.id}`);
    const brief = structuredClone(base);
    const text = {
      task: '生成一张单人竖幅头肩肖像，完整保留主发型、双肩上缘与衣领，面部为主要展示区域。画面无字幕、边框、水印或拼板。',
      style: card.id === 'ML07'
        ? '本例选用精细风格化幻想肖像表现，概括皮肤微纹理但保留面部体积、年龄与独立五官，眼妆线条清楚，材料分层。'
        : '采用精致的现代人像摄影观感，保留成年面容、可信皮肤体积与衣料结构，整体协调自然。',
      makeup: card.makeup_prompt,
      costume: '暖白色简洁小翻领衬衫，仅展示衣领和肩部衣片，连接清楚，不增加参考图中的额饰、华冠或服装。',
      material: '面料以柔和漫反射为主，衣领保留厚度与接缝，小圆环耳饰仅有克制局部反光；皮肤、唇面、头发和衣料的反射各有区别。',
      background: ({ML01:'纯白无缝背景，人物轮廓清楚。',ML02:'夜间街边环境，背景保持暗部层次，画面主要展示面部。',ML03:'自然外景，背景为柔化的较深绿色植物。',ML04:'近白高明度背景，浅色衣领仍有可辨边缘。',ML05:'柔化的冷灰背景，面部和发缘与环境分离。',ML06:'庭院日景，背景青灰植物与零散亮斑形成纵深。',ML07:'冷青幻想环境，前后景柔化，主要面部清楚。',ML08:'简洁室内生活环境，背景较灰暗，前景衣领可辨。'})[card.id],
      lighting: card.lighting_prompt
    };
    brief.request = `以照片${card.photo}的妆肤与光线关系，为同一原创三十三岁暖小麦肤色女性设计头肩肖像；保持她自己的五官、肤色与年龄，不复制参考身份。本例仅编译文字。`;
    for (const requirement of brief.requirements) {
      if (text[requirement.channel]) requirement.text = text[requirement.channel];
    }
    for (const section of brief.sections) {
      if (text[section.channel]) section.items = [{text:text[section.channel], basis:brief.requirements.filter(row => row.channel === section.channel).map(row => row.id), intent:'constraint'}];
    }
    brief.references = [{id:card.id, source:`用户照片${card.photo}，原图SHA256 ${source.sha256}；见docs/makeup-lighting-reference-sources-2026-10-19.json`,
      inspected:true, generation_input:false, authority:['makeup','lighting'], facts:[
        {id:`${card.id}:makeup`, channel:'makeup', visibility:'visible', text:Object.values(card.makeup).join(' ')},
        {id:`${card.id}:lighting`, channel:'lighting', visibility:'visible', text:card.lighting.visible}
      ]}];
    for (const channel of ['makeup','lighting']) brief.sections.find(row => row.channel === channel).items[0].basis.push(`${card.id}:${channel}`);
    brief.acceptance = brief.acceptance.map(check => {
      const requirement = brief.requirements.find(row => row.id === check.basis);
      if (text[requirement?.channel]) return {...check,question:`本例${requirement.channel === 'makeup' ? '妆肤' : requirement.channel === 'lighting' ? '照明' : '对应画面'}是否满足冻结正文的具体关系，并保留本人肤色、年龄与身份？`};
      return check;
    });
    for (const [index, question] of card.checks.entries()) brief.acceptance.push({id:`${card.id}:check:${index+1}`,basis:brief.requirements.find(row => row.channel === (index === 0 ? 'makeup' : 'lighting')).id,critical:true,question});
    brief.metadata = {evidence_kind:'reference_observation_and_text_design_only', makeup_reference:card.id, lighting_reference:card.id,
      source_sha256:source.sha256, source_image_mode:'observed_not_generation_input',
      adaptation:'保留本例三十三岁暖小麦肤色、原有五官与浅雀斑，按主卡迁移妆面与光线关系；表情、短卷发和衬衫独立设计，ML07媒介为本例明确选择。',
      image_generated:false, visual_quality_verified:false, user_accepted:false};
    return {id:card.id,label:card.label,brief};
  });
}

export function currentReferenceMakeupLightingExamples() {
  return '# 八张参考对应的完整妆光提示词\n\n由 `npm run examples:build` 从[主卡目录](../resources/portrait_surface_reference_catalog.json)与原始[来源摘要](../docs/makeup-lighting-reference-sources-2026-10-19.json)生成。每例以对应照片为妆肤、光线主源，两通道均为must并有critical验收；原图只作观察，未送入生成器。\n\n'
    + '八例共用一个原创三十三岁暖小麦肤色女性的面容、短卷发、平静神态和简洁衬衫，以展示妆光差异；不复制来源人物。本人肤色与浅雀斑保留，ML07明确采用风格化幻想表现，其余采用摄影观感。这是文字设计，尚未出图、验证还原程度或获得用户接受。\n\n'
    + referenceMakeupLightingBriefs().map(row => `## ${row.id} · ${row.label}\n\n\`\`\`text\n${compileProductionPrompt(row.brief).prompt}\n\`\`\`\n\n`).join('').trimEnd() + '\n';
}

export function currentReferenceMakeupLightingAnalysis() {
  const catalog=surfaceCatalog(), sources=surfaceSources();
  const labels={base:'底妆与肤色观感',brows:'眉妆',eyes:'眼影、眼线与睫毛',cheeks:'腮红与修容观感',lips:'唇色、唇缘与光泽',finish:'肤质完成度'};
  return '# 八张参考的妆容与光线质感详解\n\n用户要求：所有妆容和光线质感按所提供的参考图设定。以下逐张观察来自本轮八张原图，参考用途限定为妆肤与光线；不认定同人关系，也不推测真实年龄、产品、设备或制作管线。原图已按字节归档并核对SHA256；图片不随技能发布。\n\n'
    + '妆色是当前图像显示下的近似描述，光滑程度可能同时受底妆、受光、修图、压缩和媒介影响，不能据图分离其真实成因。灯光复现是设计建议，不是实测灯位。\n\n'
    + '| 照片 | 妆光方向 | 关键区别 |\n| --- | --- | --- |\n'
    + catalog.cards.map(card=>`| ${card.photo} | ${card.label} | ${card.appearance} |`).join('\n')+'\n\n'
    + catalog.cards.map(card=>{
      const source=sources.source_images.find(row=>row.id===card.id);
      return `## 照片${card.photo} · ${card.id} · ${card.label}\n\n适用：${card.suitable_for}。\n\n`
        + Object.entries(card.makeup).map(([key,value])=>`**${labels[key]}**：${value}\n`).join('\n')
        + `\n**实际可见光线**：${card.lighting.visible}\n\n**复现建议，非已知灯位**：${card.lighting.reconstruction}\n\n**色彩与清晰度**：${card.lighting.color_and_texture}\n\n`
        + '**使用边界**：'+card.limits.join('；')+'\n\n'
        + '**关键验收**：\n\n'+card.checks.map(question=>`- ${question}`).join('\n')
        + `\n\n来源：照片${card.photo}，${source.width}×${source.height}；原始文件SHA256：\`${source.sha256}\`。\n\n`;
    }).join('')
    + '## 生效规则与验证边界\n\n按[选卡与生产规则](../references/routes/reference-makeup-lighting.md)执行，必须选择主源，妆面和光线分别进入must与critical验收。保持本人肤色、年龄和五官，局部编辑只投影获准通道。八例完整文字见[提示词示例](../examples/reference-makeup-lighting-current-prompts.md)。本次没有新出图，逐图观察与结构校验不证明实际还原效果。\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  fs.writeFileSync(path.join(root, 'examples/ancient-white-asset-current-prompts.md'), currentExamples());
  fs.writeFileSync(path.join(root, 'examples/character-style-current-prompts.md'), currentCharacterStyleExamples());
  fs.writeFileSync(path.join(root, 'examples/face-design-current-prompts.md'), currentFaceDesignExamples());
  fs.writeFileSync(path.join(root, 'examples/blue-benchmark-distinct-faces-current-prompts.md'), currentBlueBenchmarkDistinctFacesExamples());
  fs.writeFileSync(path.join(root, 'examples/face-design-controls-current-prompts.md'), currentFaceControlExamples());
  fs.writeFileSync(path.join(root, 'examples/portrait-makeup-studio-current-prompts.md'), currentPortraitMakeupStudioExamples());
  fs.writeFileSync(path.join(root, 'examples/portrait-look-diversity-current-prompts.md'), currentPortraitLookExamples());
  fs.writeFileSync(path.join(root, 'examples/reference-makeup-lighting-current-prompts.md'), currentReferenceMakeupLightingExamples());
  fs.writeFileSync(path.join(root, 'docs/makeup-lighting-reference-analysis-2026-10-19.md'), currentReferenceMakeupLightingAnalysis());
  fs.writeFileSync(path.join(root, 'docs/current-asset-plan.json'), `${JSON.stringify(createAssetPlan({ presentation: 'costume_showcase', maturityGuard: 'none' }), null, 2)}\n`);
  console.log('Generated current prompts and plan; visual regression remains pending.');
}
