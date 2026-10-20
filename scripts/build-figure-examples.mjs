import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {withCharacterGoals} from './character-goals.mjs';
import {withBodyRegionChecks} from './body-proportion-contract.mjs';
import {compileProductionPrompt} from './production-prompt.mjs';
import {planFigureDesign} from './figure-design.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export function figureExamples(){
  const requirements=[
    {id:'identity',channel:'identity',priority:'must',text:'原创成年女性人物，面容自然协调，脸型与五官内部关系稳定；后续改衣装或身体造型时不改人物身份。'},
    {id:'costume',channel:'costume',priority:'must',text:'深靛蓝牛仔外套，内搭米白羊毛针织衫，搭配窄幅灰蓝真丝围巾；衣领、袖口与接缝清楚，整体设计克制。'},
    {id:'layout',channel:'composition',priority:'must',text:'单人完整全身，正面自然站立，头顶至足底完整入画，浅中性背景，柔和光线。'}
  ];
  let input={subject_kind:'character',request:'仅编写原创成年女性全身人物提示词：明确8.5头身、腰臀围比0.70（腰围÷臀围）、纤细有力的腰身与圆润上提的臀部，牛仔外套、羊毛针织内搭与真丝围巾各有真实材质和自然垂感。不生成图像。',references:[],unresolved:[],requirements,
    sections:requirements.map(r=>({label:{identity:'人物身份',costume:'服装设计',layout:'构图与灯光'}[r.id],channel:r.channel,items:[{text:r.text,basis:[r.id],intent:'constraint'}]})),
    acceptance:requirements.map(r=>({id:`${r.id}:check`,basis:r.id,critical:true,question:`本轮${r.id==='identity'?'身份':r.id==='costume'?'衣装设计':'全身构图'}是否达到声明目标？`})),target:{profile:'midjourney-8.2',surface:'web',settings:{aspect_ratio:'3:4',raw:true}}};
  input=withBodyRegionChecks(input,{targets:{head_shoulders:'头部、肩带与完整身体协调，肩颈自然连接，保留人物脸型与五官内部关系。',torso_pelvis:'胸廓、腰腹和骨盆结构完整连续，腰胯体积自然，不靠压短躯干凑长腿。',arms:'上臂、肘、前臂、腕手长度与厚度协调，姿势自然。',legs:'大腿、膝、小腿与足部成组协调，保留腿部体积和自然膝位。',support:'肌肉与软组织随承重自然收缩放松，足底接触与重心可信。',silhouette:'整体修长舒展，轮廓和服装体积统一，鞋跟、衣摆与头饰不冒充人体高度。'}});
  input=withCharacterGoals(input,{ageStage:'adult',characterType:'female',framing:'full_body',garments:[{id:'coat',part:'深靛蓝外套',fabric:'denim'},{id:'knit',part:'米白内搭',fabric:'knit'},{id:'scarf',part:'灰蓝围巾',fabric:'silk'}]});
  const result=compileProductionPrompt(input);
  const portrait=planFigureDesign({age_stage:'adult',character_type:'female',body_baseline:input.figure_design.body_baseline,framing:'portrait',garments:[{id:'shirt',part:'可见衬衫领肩',fabric:'cotton'}]});
  const child=planFigureDesign({age_stage:'child',framing:'full_body',garments:[{id:'shirt',part:'儿童衬衫',fabric:'cotton'}]});
  const doc=`# 明确比例与面料：实际输出正反例\n\n由 [构建脚本](../scripts/build-figure-examples.mjs) 生成，仅文本编译，没有生图或人体测量。完整可运行 brief 见 [成年全身例子](adult-body-fabric-brief.json)。\n\n## 成年全身：实际编译输出\n\n\`\`\`text\n${result.model_execution.request.submission_text}\n\`\`\`\n\n8.5头身与0.70腰臀围比是本用户方向的可配置设计默认，不是用户实测数据、厘米测量或唯一科学黄金比例。0.70指腰围÷臀围，不是正面像素宽度比；数值越低腰臀反差通常越强。所有造型继承同一身体基准，姿态、服装和透视不重设计身体。文本校验不能替代图像测量或视觉验收。以上正文可手动粘贴，MJ 网页不需要任何参考 URL。\n\n## 肖像：只写可见身体\n\n\`\`\`text\n${portrait.body}\n${portrait.cloth[0].zh}\n\`\`\`\n\n## 儿童全身：自然、非性化比例\n\n\`\`\`text\n${child.body}\n${child.cloth[0].zh}\n\`\`\`\n\n## 反例及处理\n\n| 反例 | 处理 |\n| --- | --- |\n| 只写“黄金比例、完美身材”而缺少成年全身具体数值 | 当前契约检查拒绝替换后的正文，补成具体8.5头身与可见身体关系 |\n| 把0.70解释为正面像素宽度比或臀围÷腰围 | 拒绝错误定义；只接受腰围÷臀围，不反转数值 |\n| 同一人物第二套改为9头身或腰臀围比0.75，仍沿用原基准 | 拒绝身体基准漂移；须明确授权重设计身体后另建基准 |\n| 用户显式指定腰臀围比0.75 | 原样保留并说明偏离本用户默认，不夹到0.70 |\n| 未知年龄、未成年或其他类型自动套0.70 | 不应用成年女性默认；肖像只继承已提供基准 |\n| 默认传7.5或9.5头身却不声明用户覆盖 | 拒绝越界，不默默夹到8–9；明确用户原值与来源后保留并警告 |\n| 锁定参考身体，同时要求新8.5头身 | 报冲突，不能伪称两者都已满足或猜参考头身数 |\n| 给儿童或年龄未知人物传8.5头身 | 拒绝成人数值，改用年龄适配自然比例 |\n| 肖像写“完整8.5头身已展示” | 拒绝完整头身数值，按本画幅可见范围写要求 |\n| 牛仔、针织、真丝都写“轻薄飘逸” | 补具体衣片、材料、厚薄、重量及对应受力褶皱；不把牛仔改成纱 |\n| 只写“高级真实面料”或添加胸腰臀厘米字段 | 不接受未知面料或测量字段，不编造数据 |\n\n新契约不回写或认证历史 brief。指定体型、参考身体锁定与局部范围继续优先，冲突在审计警告可见。\n`;
  return {input,doc};
}
export function writeFigureExamples(){
  const {input,doc}=figureExamples();
  fs.writeFileSync(path.join(root,'examples/adult-body-fabric-brief.json'),JSON.stringify(input,null,2)+'\n');
  fs.writeFileSync(path.join(root,'examples/figure-proportion-fabric.md'),doc);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))writeFigureExamples();
