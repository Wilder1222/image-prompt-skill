import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

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

const verdict = (run, checkId) => Array.isArray(run.checks) ? run.checks.find(check => check?.id === checkId)?.verdict ?? null : null;

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const completed = run => ['needs_review', 'needs_revision', 'reviewer_qualified'].includes(run.status);
const isActualOutput = run => completed(run) && nonempty(run.output_file) && typeof run.output_sha256 === 'string' && /^[a-f0-9]{64}$/i.test(run.output_sha256);

// Check declared review consistency only; this does not certify image quality.
function qualificationConsistent(run) {
  const checks = run.checks;
  const criteria = run.target?.acceptance ?? checks;
  if (!Array.isArray(checks) || !checks.length || !Array.isArray(criteria) || !criteria.length) return false;
  if (checks.some(c => !c) || criteria.some(c => !c || typeof c.critical !== 'boolean')) return false;
  if (new Set(checks.map(c => c.id)).size !== checks.length ||
      new Set(criteria.map(c => c.id)).size !== criteria.length || checks.length !== criteria.length) return false;
  if (!criteria.some(c => c.id === 'body-check' && c.critical === true)) return false;
  if (!criteria.every(c => {
    const check = checks.find(item => item.id === c.id);
    return nonempty(c.id) && check && nonempty(check.evidence) &&
      ['pass', 'fail', 'uncertain', 'not_assessable'].includes(check.verdict) &&
      (!c.critical || check.verdict === 'pass');
  })) return false;
  if (run.edit_scope || run.scope_review) {
    const scope = run.scope_review;
    if (!scope || scope.verdict !== 'pass' || !nonempty(scope.change_evidence) || !nonempty(scope.preservation_evidence)) return false;
    if (scope.preservation_checks !== undefined && (!Array.isArray(scope.preservation_checks) ||
        scope.preservation_checks.some(c => !c || c.verdict !== 'pass' || !nonempty(c.evidence)))) return false;
  }
  return true;
}

export function auditCharacterStyleEvidence({ root = process.cwd(), catalogPath = 'resources/character_style_evidence_catalog.json', verifyFiles = false } = {}) {
  const catalog = readJson(root, catalogPath);
  const workflows = readJson(root, 'resources/asset_style_workflows.json');
  if (catalog.schema_version !== 1 || !Array.isArray(catalog.routes)) throw new Error('不支持的风格证据目录');
  const profileIds = Object.keys(workflows.profiles ?? {}).filter((id) => workflows.profiles[id].label);
  const errors = [];
  const seenReports = new Set();
  const seenStyles = new Set(), seenRuns = new Set(), seenOutputs = new Set();
  const verifiedOutputs = new Set();
  const routes = (catalog.routes ?? []).map((route) => {
    const errorStart = errors.length;
    const profile = workflows.profiles?.[route.style_id];
    if (!profileIds.includes(route.style_id)) {
      errors.push(`证据目录引用了未知风格: ${route.style_id}`);
      return { style_id: route.style_id, label: null, profile_configured: false, evidence_reports: [], recorded_outputs: 0, file_verified_outputs: verifyFiles ? 0 : null, completed_runs: 0, consistent_qualified_reports: 0, medium_pass_runs: 0, body_pass_runs: 0, evidence_status: 'invalid' };
    }
    const runs = [];
    const reportNames = [];
    let completedRuns = 0, duplicateOutputs = 0;
    if (seenStyles.has(route.style_id)) errors.push(`重复风格映射: ${route.style_id}`);
    seenStyles.add(route.style_id);
    for (const selector of route.evidence ?? []) {
      if (!nonempty(selector.report) || Object.keys(selector).some(key => !['report', 'case_id', 'style'].includes(key)) ||
          ['case_id', 'style'].some(key => Object.hasOwn(selector, key) && !nonempty(selector[key]))) {
        errors.push(`${route.style_id}: 无效筛选条件`);
        continue;
      }
      let report;
      try { report = readJson(root, selector.report); }
      catch (error) { errors.push(error.message); continue; }
      seenReports.add(selector.report);
      reportNames.push(selector.report);
      if (!report || !Array.isArray(report.runs) || report.runs.some(run => !run || typeof run !== 'object')) {
        errors.push(`${selector.report}: 无效 runs 数组`);
        continue;
      }
      const allRuns = report.runs;
      const completedCount = allRuns.filter(completed).length;
      if (!Number.isSafeInteger(report.known_completed_calls) || report.known_completed_calls !== completedCount) {
        errors.push(`${selector.report} 的 known_completed_calls 与已完成记录数 ${completedCount} 不一致`);
      }
      const selected = selectedRuns(report, selector);
      if (!selected.length) errors.push(`${selector.report}: 筛选未命中任何记录`);
      for (const run of selected) {
        if (!nonempty(run.run_id) || seenRuns.has(run.run_id)) {
          if (isActualOutput(run) && seenOutputs.has(run.output_sha256.toLowerCase())) duplicateOutputs++;
          errors.push(`${selector.report}: 缺失或重复 run_id`);
          continue;
        }
        seenRuns.add(run.run_id);
        if (!completed(run)) {
          if (run.output_file || run.output_sha256) errors.push(`${run.run_id}: 未完成记录不能声明输出`);
          if (!['tool_error', 'interrupted', 'not_started'].includes(run.status)) errors.push(`${run.run_id}: 未知状态`);
          continue;
        }
        if (!isActualOutput(run)) {
          completedRuns++;
          errors.push(`${run.run_id}: 已完成记录缺少有效输出路径或 SHA-256`);
          continue;
        }
        completedRuns++;
        const digest = run.output_sha256.toLowerCase();
        if (seenOutputs.has(digest)) {
          duplicateOutputs++;
          errors.push(`${run.run_id}: 跨路线或报告重复输出`);
          continue;
        }
        seenOutputs.add(digest);
        runs.push(run);
        if (run.status === 'reviewer_qualified' && !qualificationConsistent(run)) errors.push(`${run.run_id}: 合格声明与九头身、关键检查或编辑范围记录矛盾`);
        if (verifyFiles) {
          try {
            if (!nonempty(report.evidence_directory)) throw new Error('缺少 evidence_directory');
            const bytes = fs.readFileSync(path.resolve(root, report.evidence_directory, run.output_file));
            if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('输出哈希不匹配');
            verifiedOutputs.add(digest);
          } catch (error) { errors.push(`${run.run_id}: 本地文件核验失败 (${error.message})`); }
        }
      }
    }
    const actualOutputs = runs.length;
    const qualified = runs.filter(run => run.status === 'reviewer_qualified' && qualificationConsistent(run) &&
      (!verifyFiles || verifiedOutputs.has(run.output_sha256.toLowerCase()))).length;
    if (actualOutputs === 0) errors.push(`${route.style_id} 没有有效登记输出`);
    return {
      style_id: route.style_id,
      label: profile.label,
      profile_configured: true,
      evidence_reports: [...new Set(reportNames)],
      completed_runs: completedRuns,
      recorded_outputs: actualOutputs,
      file_verified_outputs: verifyFiles ? runs.filter(run => verifiedOutputs.has(run.output_sha256.toLowerCase())).length : null,
      consistent_qualified_reports: qualified,
      medium_pass_runs: runs.filter((run) => verdict(run, 'medium-check') === 'pass').length,
      body_pass_runs: runs.filter((run) => verdict(run, 'body-check') === 'pass').length,
      duplicate_outputs: duplicateOutputs,
      evidence_status: errors.length > errorStart ? 'invalid' : qualified > 0 ? 'has_consistent_qualified_reports' : 'unresolved'
    };
  });
  const missingProfiles = profileIds.filter((id) => !routes.some((route) => route.style_id === id));
  for (const id of missingProfiles) errors.push(`人物风格配置未进入证据目录: ${id}`);
  const total = routes.reduce((sum, route) => sum + route.recorded_outputs, 0);
  const qualified = routes.reduce((sum, route) => sum + route.consistent_qualified_reports, 0);
  return {
    schema_version: 2,
    purpose: '核对风格配置、登记输出和人工结论的一致性；不执行提示词编译或视觉评分。',
    hard_rule: '所有人物路线仍以颅顶至下巴头长定义的黄金九头身为硬性目标；本审计不替代逐图测量。',
    verification_mode: verifyFiles ? 'local_output_sha256' : 'report_metadata_only',
    configured_routes: profileIds.length,
    routes_with_recorded_outputs: routes.filter(route => route.recorded_outputs > 0).length,
    recorded_outputs: total,
    file_verified_outputs: verifyFiles ? verifiedOutputs.size : null,
    consistent_qualified_reports: qualified,
    evidence_reports: [...seenReports].sort(),
    routes,
    errors,
    boundaries: [
      '登记输出来自报告中的非空路径和 SHA-256；仅 local_output_sha256 模式读取本地文件并核对摘要。',
      '合格声明只检查报告自洽性，不认证原始回执、像素内容、人工观察、用户验收或批量稳定性。',
      '媒介项通过不能抵消九头身或其他关键项失败；风格配置存在不能替代编译检查。',
      '只汇总显式目录指定的实验，不是人物专项全部输出总数。'
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg.startsWith('--') && arg !== '--verify-files') || args.filter(arg => !arg.startsWith('--')).length > 1) throw new Error('用法: character-style-evidence-audit.mjs [输出文件] [--verify-files]');
  const result = auditCharacterStyleEvidence({ verifyFiles: args.includes('--verify-files') });
  const outputPath = args.find(arg => !arg.startsWith('--')) ?? 'docs/character-style-evidence-audit.json';
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, errors: result.errors, recorded_outputs: result.recorded_outputs, file_verified_outputs: result.file_verified_outputs, consistent_qualified_reports: result.consistent_qualified_reports }));
  if (result.errors.length) process.exitCode = 1;
}
