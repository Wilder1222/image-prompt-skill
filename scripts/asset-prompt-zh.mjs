// User-facing Chinese tagged rendering. Planning/locks are validated by asset-master first.
const tag = (name, text) => `【${name}】${text}`;
const faces = {
  beauty_first_clean: '保留参考人物的脸型、面颊体积、眼距和自然眼睑，以干净妆容和克制皮肤反光呈现美感，不套用统一脸型。',
  beauty_first_character: '保留参考人物独有的脸型、眉眼关系、面颊体积、嘴角和神态；美感来自自然妆容与细腻皮肤，不扩大眼睛、收窄鼻翼或尖化下巴。',
  humanized_real_light: '保留人物辨识度，在现有面容上增加真实眼睑厚度、鼻唇结构和区域式皮肤反光，不通过衰老、疲态或面颊凹陷制造真人感。',
  humanized_real_full: '呈现真人棚拍的面部软组织、自然大小的眼睛、眼睑厚度、克制角膜反光、细微肤色变化与唇纹。保留人物辨识特征，不采用瓷偶皮肤、统一塑料高光或夸张游戏角色眼睛。',
  stylized_beauty: '保留参考的风格化美感、人物特征与表观年龄，控制面部写实程度，不擅自改为完全真人照片。',
};
const natural = '采用普通成年人的自然站姿比例，约七至七点五头身作为本次设计参考；一头按颅顶至下巴计算，不计发髻、头饰、鞋跟或拖尾。半身参考不能提供原人物的精确身高。头部保持正常大小，颈部不过长，胸廓、腰腹与骨盆关系完整；上下腿长度协调，不缩头、不抬高解剖腰线、不把腰以下整体拉长。衣服套在自然身体上，裙长与拖尾不等于身体长度。';
const fashion = '按本次明确选定的时装比例设计，约八点六至九头身，头长不包含发髻或头饰。保留完整躯干与协调的髋膝踝关系，不只拉长腿的一段，不极端缩头；这是明确选择的时装风格，不是通用真人比例。';
const materials = '按实际衣料区分厚薄、重量、透光与反射：主料有织纹和受力褶皱，内层以较安静的大褶为主，已有纱层呈现薄边与叠层透光，刺绣是有方向和轻微起伏的线材，金属有厚度与固定点。不要让所有层都变成同一种亮面细皱。指定素面保持无纹样，花纹集中在本套方案指定的衣片，不自动新增纱、金纹或配饰。';
const light = '纯白无缝棚背景与白色地面，大面积柔和主光配合较弱补光，保留脸部体积、织物层次与脚下轻微接触阴影。白衣高光不过曝，利用厚薄、明度和柔光分离衣料与背景，不加黑色描边或影视光晕。';
const hands = mode => mode === 'relaxed_down_safe' ? '双臂自然下垂，略离躯干以展示衣服，手腕放松、可见手指结构连贯，不刻意张开十指。' : '双手在下腹前自然轻叠，右手轻搭左手手背，手腕方向清楚，手指放松不交叉纠缠。每手在解剖上为一拇指四手指，允许自然遮挡，只检查可见指节与袖口连接。';
const body = c => c.proportion_profile === 'P9_FASHION_ASSET' ? fashion : natural;
const age = c => c.maturity_guard === 'none' ? '保持参考表观年龄，不因真人化而增加年龄。' : c.maturity_guard === 'youthful_18_22' ? '本预设使用十八至二十二岁的成年青年视觉范围，保留柔和面颊，避免疲态、深眼窝和过重眼下阴影。' : '保持精致的成年青年状态，不用疲态、深纹或凹陷面颊增加成熟感。';

export function renderTaggedChinese(result) {
  const c=result.configuration, rows=[];
  if(result.reference_mode==='full_body_anchor')return [
    tag('P0 参考权限','以输入的完整全身图作为唯一人物与造型母图，生成一张三比四白底全身图。'),
    tag('P0 保留范围','保留原面容、表观年龄、面部表现、头部大小、身体比例、发型、饰物、服装结构、配色、纹样位置、腰线、袖量、拖尾、手势和可见鞋履。'),
    tag('P1 构图与材质','发饰至落地衣摆完整入画，四周留白；自然遮鞋和手指重叠可以保留，维持原软光与材料层次。'),
    tag('P0 禁止重设','不重新补画已给出的下半身，不增加衣层、首饰、透明度或更换面容，不套用新的头身比或默认站姿。'),
  ].join('\n\n');
  if(result.stage==='generate'){
    rows.push(tag('P0 任务与参考','根据实际输入参考，制作单人、正面、白底、完整全身角色定妆照。参考人物负责面容与表观年龄；可见服装负责本套设计起点，未入画部位按明确方案补全，不能冒称原图已有。'));
    rows.push(tag('P0 人物比例',body(c)));
    rows.push(tag('P0 正面与取景','头部端正，面部、双肩与骨盆朝向镜头，目光看镜头，双脚自然承重。使用平视感和较弱透视，避免仰拍、广角和人为拉长。发饰、双手、完整衣摆与鞋履落地关系均入画；四周保留白边，不能为填满竖幅拉高人物。长裙自然遮鞋时露出鞋尖即可。'));
    rows.push(tag('P1 人脸身份与质感',faces[c.face_profile]+' '+age(c)));
    rows.push(tag('P1 服装与造型',c.design_freedom==='moderate'?'允许适度优化领袖、衣片、腰部、配色比例、饰物和发型细节，保留本套服装的辨识特征；根据参考写清本次改案，不把所有造型冻结，也不把每个人套成同一件华服。':'保留参考可见的发型、配饰、服装结构与配色；未见区域遵循明确补全方案，没有方案时克制延展。'));
    if(c.presentation_profile==='costume_showcase')rows.push(tag('P1 衣片展示','展示领肩、腰部连接、袖口和内外衣片，长袍可保留原有宽袖与逐渐展开的裙摆。衣片的竖向线条用于展示剪裁，不用于延长身体；腰带是服装结构，不应推高骨盆位置。'));
    rows.push(tag('P1 手部与姿态',hands(c.hand_mode)),tag('P2 服装材质',materials),tag('P2 白底棚拍',light));
  }else{
    rows.push(tag('P0 编辑对象','只编辑输入的当前母图，先遵守本轮明确允许改变的范围；已经通过的部分保持，不把局部修复当成整套重新设计。'));
    if(result.stage==='face')rows.push(tag('P0 锁定范围','保持人物五官几何、表观年龄、身体比例、发型轮廓、服装、手势、鞋履、构图、背景与光位。'),tag('P1 面部表现',faces[c.face_profile]+' '+age(c)));
    if(result.stage==='structure'){
      rows.push(tag('P0 锁定范围','保持人脸身份、年龄与已接受面部表现、发型、服装设计、配色、材料和灯光。'));
      if(result.focus==='hands')rows.push(tag('P0 仅修手部','保持身体比例、原手势、衣摆、相机取景和鞋履，只修可见手指粘连、重复指节及手腕袖口关系，允许遮挡，不要求十指展开。'));
      else if(result.focus==='framing')rows.push(tag('P0 仅修取景','保持身体比例、手部、姿态与衣服设计，仅调整取景和既有鞋边遮挡，使发饰、衣摆及鞋履落地关系可读，不重新设计服装。'));
      else {rows.push(tag('P1 人物比例',body(c)));if(!result.focus)rows.push(tag('P1 手部与取景',hands(c.hand_mode)+' 保留完整发饰、衣摆、鞋履和白边。'));else rows.push(tag('P0 比例修复边界','保留原手势、鞋款与画幅，调整身体各段的协调关系及衣料如何覆盖身体，不通过拉长裙摆伪造身体比例。'));}
    }
    if(result.stage==='material-light'){
      rows.push(tag('P0 锁定范围','保持人脸身份、年龄、身体比例、发型、姿态、手部、鞋形、服装结构配色和取景。'));
      if(result.focus!=='lighting')rows.push(tag('P1 既有材料',materials+' 本轮只作用于已经存在的材料，不新增衣层、花纹或配饰。'));
      if(result.focus!=='materials')rows.push(tag('P1 棚拍光线',light));
      rows.push(tag('P0 局部边界',result.focus==='materials'?'灯位、背景和地面阴影保持，只改变已有材料的反射与厚薄表现。':result.focus==='lighting'?'保持已有材质和纹理，只调整照明、浅色边缘分离和接触阴影。':'只修已有材料与光线，不重建脸部、身体或衣服结构。'));
    }
  }
  return rows.join('\n\n');
}
