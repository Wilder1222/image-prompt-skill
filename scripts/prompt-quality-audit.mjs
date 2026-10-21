import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileProductionPrompt,objectHash} from './production-prompt.mjs';

// Structural diagnostics only. Never rewrite authored prose or approve image quality.
export function auditPromptQuality(input) {
  const compiled = compileProductionPrompt(input), diagnostics = [], groups = new Map();
  const clauses = compiled.audit.delivery_clauses;
  for (const clause of clauses) {
    const group = groups.get(clause.text) ?? [];
    group.push(clause.location); groups.set(clause.text, group);
  }
  for (const [text, locations] of groups) if (locations.length > 1) diagnostics.push({
    code: 'repeated_clause', locations, characters: [...text].length,
    advice: '核对重复是否必要；若合并，保留全部来源依据与必需目标，不机械删除正文。'
  });
  for (const list of ['changes', 'preserve']) for (const [index, text] of (input.edit_scope?.[list] ?? []).entries()) {
    const locations = groups.get(text.trim());
    if (locations) diagnostics.push({code: 'scope_repeats_clause', locations, scope: {list, index},
      characters: [...text.trim()].length, advice: '将编辑范围改写为明确且简短的区域与边界，详细视觉表达留在对应正文。'});
  }
  const faceRows = input.requirements.filter(row => /^FD:/.test(row.id));
  for (const channel of new Set(faceRows.map(row => row.channel))) {
    if (channel === 'identity') continue;
    const prior = input.requirements.filter(row => row.channel === channel && !/^FD:/.test(row.id) && !row.character_goal);
    if (prior.length) diagnostics.push({code: 'face_layer_overlap', channel,
      requirements: prior.map(row => row.id), face_requirements: faceRows.filter(row => row.channel === channel).map(row => row.id),
      advice: '人工检查捏脸呈现与基底是否互补；清理相反的神态、妆发、光线或视点，并同步要求和验收。重叠本身不证明矛盾。'});
  }
  return {status: diagnostics.length ? 'needs_review' : 'diagnostics_clear', prompt_sha256: compiled.prompt_sha256,diagnostics_sha256:objectHash(diagnostics),
    statistics: {characters: [...compiled.prompt].length, clauses: clauses.length, must_requirements: input.requirements.filter(r => r.priority === 'must').length,
      channels: [...new Set(clauses.map(row => row.channel))].map(channel => ({channel, clauses: clauses.filter(row => row.channel === channel).length}))},
    diagnostics, evidence: {structural_checks_passed: true, semantic_quality_verified: false, image_generated: false, visual_quality_verified: false}};
}

// Decisions are authored review records, not authentication or automatic semantic approval.
export function assertPromptQualityReview(audit,review) {
  if(review===undefined&&!audit.diagnostics.length)return;
  const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  if(!plain(review)||Object.keys(review).some(key=>!['prompt_sha256','diagnostics_sha256','reviewer','decisions'].includes(key))||
     review.prompt_sha256!==audit.prompt_sha256||review.diagnostics_sha256!==audit.diagnostics_sha256||
     typeof review.reviewer!=='string'||!review.reviewer.trim()||!Array.isArray(review.decisions))
    throw new Error('prompt quality diagnostics need a current quality_review bound to prompt_sha256 and diagnostics_sha256; run prompt:audit first');
  const expected=audit.diagnostics.map(row=>objectHash(row)),seen=new Set();
  for(const decision of review.decisions){
    if(!plain(decision)||Object.keys(decision).some(key=>!['diagnostic_sha256','resolution','reason'].includes(key))||
       !expected.includes(decision.diagnostic_sha256)||seen.has(decision.diagnostic_sha256)||decision.resolution!=='retain'||typeof decision.reason!=='string'||!decision.reason.trim())
      throw new Error('quality_review needs one supported retain decision and reason for each remaining diagnostic');
    seen.add(decision.diagnostic_sha256);
  }
  if(seen.size!==expected.length)throw new Error('quality_review does not cover every current diagnostic');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const file = args.length === 1 ? args[0] : args.length === 2 && args[0] === '--input' ? args[1] : null;
    if (!file || file.startsWith('--')) throw new Error('usage: prompt-quality-audit.mjs brief.json | --input brief.json');
    console.log(JSON.stringify(auditPromptQuality(JSON.parse(fs.readFileSync(file, 'utf8'))), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
