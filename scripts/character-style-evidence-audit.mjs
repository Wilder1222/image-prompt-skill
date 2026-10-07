import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const readJson = (root, relativePath) => {
  const absolutePath = path.resolve(root, relativePath);
  if (!fs.existsSync(absolutePath)) throw new Error(`缺少证据文件: ${relativePath}`);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
};

const selectedRuns = (report, selector = {}) => (report.runs ?? []).filter((run) => {
  if (selector.case_id && run.case_id !== selector.case_id) return false;
  if (selector.style && run.style !== selector.style) return false;
  return true;
});

const verdict = (run, checkId) => (run.checks ?? []).find((check) => check.id === checkId)?.verdict ?? null;

const isActualOutput = (run) => typeof run.output_file === 'string' && typeof run.output_sha256 === 'string';

export function auditCharacterStyleEvidence({ root = process.cwd(), catalogPath = 'resources/character_style_evidence_catalog.json' } = {}) {
  const catalog = readJson(root, catalogPath);
  const workflows = readJson(root, 'resources/asset_style_workflows.json');
  const profileIds = Object.keys(workflows.profiles ?? {}).filter((id) => workflows.profiles[id].label);
  const errors = [];
  const seenReports = new Set();
  const routes = (catalog.routes ?? []).map((route) => {
    const profile = workflows.profiles?.[route.style_id];
    if (!profile) {
      errors.push(`证据目录引用了未知风格: ${route.style_id}`);
      return { style_id: route.style_id, label: null, compiled: false, evidence_reports: [], actual_outputs: 0, completed_runs: 0, reviewer_qualified_runs: 0, medium_pass_runs: 0, body_pass_runs: 0, visual_status: 'invalid' };
    }
    const runs = [];
    const reportNames = [];
    for (const selector of route.evidence ?? []) {
      const report = readJson(root, selector.report);
      seenReports.add(selector.report);
      reportNames.push(selector.report);
      const allRuns = report.runs ?? [];
      if (Number.isInteger(report.known_completed_calls) && report.known_completed_calls !== allRuns.length) {
        errors.push(`${selector.report} 的 known_completed_calls=${report.known_completed_calls} 与 runs=${allRuns.length} 不一致`);
      }
      runs.push(...selectedRuns(report, selector));
    }
    const outputKeys = runs.filter(isActualOutput).map((run) => run.output_sha256 ?? run.output_file);
    const duplicateOutputs = outputKeys.length - new Set(outputKeys).size;
    if (duplicateOutputs > 0) errors.push(`${route.style_id} 映射中存在 ${duplicateOutputs} 个重复输出`);
    const actualOutputs = runs.filter(isActualOutput).length;
    const qualified = runs.filter((run) => run.status === 'reviewer_qualified').length;
    if (actualOutputs === 0) errors.push(`${route.style_id} 没有可追溯的真实模型输出`);
    return {
      style_id: route.style_id,
      label: profile.label,
      compiled: true,
      evidence_reports: [...new Set(reportNames)],
      completed_runs: runs.length,
      actual_outputs: actualOutputs,
      reviewer_qualified_runs: qualified,
      medium_pass_runs: runs.filter((run) => verdict(run, 'medium-check') === 'pass').length,
      body_pass_runs: runs.filter((run) => verdict(run, 'body-check') === 'pass').length,
      duplicate_outputs: duplicateOutputs,
      visual_status: actualOutputs === 0 ? 'no_visual_evidence' : qualified === actualOutputs ? 'qualified' : 'unresolved'
    };
  });
  const missingProfiles = profileIds.filter((id) => !routes.some((route) => route.style_id === id));
  for (const id of missingProfiles) errors.push(`人物风格配置未进入证据目录: ${id}`);
  const total = routes.reduce((sum, route) => sum + route.actual_outputs, 0);
  const qualified = routes.reduce((sum, route) => sum + route.reviewer_qualified_runs, 0);
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    purpose: '审计九条人物风格的编译支持与实图证据覆盖；不进行图像评分，不把媒介检查通过升级为九头身或资产合格。',
    hard_rule: '所有人物路线仍以颅顶至下巴头长定义的黄金九头身为硬性目标；本审计不替代逐图测量。',
    compiled_routes: profileIds.length,
    visual_routes_with_outputs: routes.filter((route) => route.actual_outputs > 0).length,
    actual_outputs: total,
    reviewer_qualified_outputs: qualified,
    evidence_reports: [...seenReports].sort(),
    routes,
    errors,
    boundaries: [
      '脚本只读取报告中的结构化字段和人工复核结论，不读取像素，也不自动测量头身比。',
      'medium_pass_runs 只表示对应媒介检查通过；visual_status 只有每个实际输出均为 reviewer_qualified 才能为 qualified。',
      '报告缺失、调用数漂移、风格映射漂移或重复输出会进入 errors。'
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = auditCharacterStyleEvidence();
  const outputPath = process.argv[2] ?? 'docs/character-style-evidence-audit.json';
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, errors: result.errors.length, compiled_routes: result.compiled_routes, actual_outputs: result.actual_outputs, reviewer_qualified_outputs: result.reviewer_qualified_outputs }));
  if (result.errors.length) process.exitCode = 1;
}
