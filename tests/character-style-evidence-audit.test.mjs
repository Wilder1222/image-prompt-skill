import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { auditCharacterStyleEvidence } from '../scripts/character-style-evidence-audit.mjs';

test('九条人物风格配置有登记输出，默认审计不宣称核验本地文件', () => {
  const report = auditCharacterStyleEvidence();
  assert.equal(report.errors.length, 0);
  assert.equal(report.configured_routes, 9);
  assert.equal(report.routes_with_recorded_outputs, 9);
  assert.equal(report.verification_mode, 'report_metadata_only');
  assert.equal(report.file_verified_outputs, null);
  assert.ok(report.routes.every(route => route.profile_configured && route.recorded_outputs > 0));
});

test('媒介通过不能伪装成整项资产合格', () => {
  const report = auditCharacterStyleEvidence();
  const route = report.routes.find((item) => item.style_id === 'photographic_character');
  assert.ok(route.medium_pass_runs > 0);
  assert.equal(route.consistent_qualified_reports, 0);
  assert.equal(route.evidence_status, 'unresolved');
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'character-style-audit-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('character-style-audit-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), JSON.stringify(data));
  };
  const bytes = Buffer.from('用于摘要核验的字节，不声称它是已检查的图像');
  const run = {run_id:'one', status:'reviewer_qualified', output_file:'one.png', output_sha256:createHash('sha256').update(bytes).digest('hex'),
    checks:[{id:'body-check',critical:true,verdict:'pass',evidence:'人工记录的比例观察'}, {id:'medium-check',critical:true,verdict:'pass',evidence:'人工记录的媒介观察'}]};
  run.target = {acceptance:run.checks.map(({verdict,evidence,...criterion}) => criterion)};
  const report = {known_completed_calls:1,evidence_directory:'images',runs:[run]};
  const catalog = {schema_version:1,routes:[{style_id:'test',evidence:[{report:'docs/evidence.json'}]}]};
  write('resources/asset_style_workflows.json', {profiles:{test:{label:'测试风格'}}});
  fs.mkdirSync(path.join(root,'images'));
  fs.writeFileSync(path.join(root,'images/one.png'),bytes);
  return {root,run,report,catalog,write,audit(options={}) {
    write('docs/evidence.json',report);
    write('resources/character_style_evidence_catalog.json',catalog);
    return auditCharacterStyleEvidence({root,...options});
  }};
}

test('报告调用数漂移会被发现，未派发记录不算已完成', t => {
  const f=fixture(t);
  f.report.runs.push({run_id:'two',status:'not_started'});
  assert.deepEqual(f.audit().errors,[]);
  f.report.known_completed_calls=2;
  assert.ok(f.audit().errors.some(error=>error.includes('known_completed_calls')));
});

test('空路径和伪造摘要不计输出，也不计合格', t => {
  const f=fixture(t);
  f.run.output_file=''; f.run.output_sha256='';
  const audit=f.audit();
  assert.equal(audit.recorded_outputs,0);
  assert.equal(audit.consistent_qualified_reports,0);
  assert.equal(audit.routes[0].evidence_status,'invalid');
});

test('合格状态不能覆盖失败、待审、缺失或重复的关键检查', t => {
  const f=fixture(t), original=structuredClone(f.run.checks);
  for (const checks of [
    original.map(c=>({...c,verdict:'fail'})), original.map(c=>({...c,verdict:'uncertain'})),
    [original[1]], [original[0],original[0]], original.map(c=>({...c,evidence:''}))
  ]) {
    f.run.checks=checks;
    const audit=f.audit();
    assert.equal(audit.consistent_qualified_reports,0);
    assert.ok(audit.errors.some(error=>error.includes('合格声明')));
  }
});

test('关键检查通过仍不能覆盖局部编辑范围待审', t => {
  const f=fixture(t);
  f.run.edit_scope={preserve:['衣装']};
  f.run.scope_review={verdict:'uncertain',change_evidence:'调整了笔触',preservation_evidence:'衣装是否改变未确认'};
  assert.equal(f.audit().consistent_qualified_reports,0);
});

test('只核验报告时不冒充本地文件已验证，哈希错误或文件缺失会失败', t => {
  const f=fixture(t);
  assert.equal(f.audit().file_verified_outputs,null);
  const verified=f.audit({verifyFiles:true});
  assert.deepEqual(verified.errors,[]);
  assert.equal(verified.file_verified_outputs,1);
  assert.equal(verified.consistent_qualified_reports,1);
  assert.equal(verified.routes[0].evidence_status,'has_consistent_qualified_reports');
  fs.writeFileSync(path.join(f.root,'images/one.png'),'changed');
  let result=f.audit({verifyFiles:true});
  assert.equal(result.file_verified_outputs,0);
  assert.equal(result.consistent_qualified_reports,0);
  assert.ok(result.errors.some(error=>error.includes('哈希不匹配')));
  f.run.output_file='missing.png';
  result=f.audit({verifyFiles:true});
  assert.equal(result.file_verified_outputs,0);
  assert.ok(result.errors.some(error=>error.includes('本地文件核验失败')));
});

test('重复输出只登记一次，重复路线、空筛选和未知字段都报错', t => {
  const f=fixture(t);
  f.report.runs.push({...structuredClone(f.run),run_id:'two'});
  f.report.known_completed_calls=2;
  let result=f.audit();
  assert.equal(result.recorded_outputs,1);
  assert.ok(result.errors.some(error=>error.includes('重复输出')));
  f.catalog.routes.push(structuredClone(f.catalog.routes[0]));
  assert.ok(f.audit().errors.some(error=>error.includes('重复风格')));
  f.catalog.routes=f.catalog.routes.slice(0,1);
  f.catalog.routes[0].evidence[0].case_id='missing';
  assert.ok(f.audit().errors.some(error=>error.includes('筛选未命中')));
  f.catalog.routes[0].evidence[0].typo='x';
  assert.ok(f.audit().errors.some(error=>error.includes('无效筛选')));
});

test('不同风格中的相同文件摘要不能重复增加总数', t => {
  const f=fixture(t);
  f.write('resources/asset_style_workflows.json',{profiles:{test:{label:'风格一'},other:{label:'风格二'}}});
  f.run.case_id='first';
  f.report.runs.push({...structuredClone(f.run),run_id:'two',case_id:'second'});
  f.report.known_completed_calls=2;
  f.catalog.routes[0].evidence[0].case_id='first';
  f.catalog.routes.push({style_id:'other',evidence:[{report:'docs/evidence.json',case_id:'second'}]});
  const audit=f.audit();
  assert.equal(audit.recorded_outputs,1);
  assert.equal(audit.routes[1].duplicate_outputs,1);
  assert.equal(audit.routes[1].evidence_status,'invalid');
});

test('报告缺失和未知风格保留结构化错误与有效数值汇总', t => {
  const f=fixture(t);
  f.catalog.routes[0].evidence[0].report='docs/missing.json';
  assert.ok(f.audit().errors.some(error=>error.includes('缺少证据文件')));
  f.catalog.routes[0].style_id='unknown';
  const result=f.audit();
  assert.equal(result.recorded_outputs,0);
  assert.ok(result.errors.some(error=>error.includes('未知风格')));
});

function reviewNote(f, check='body-check', verdict='fail') {
  f.run.snapshot_sha256='a'.repeat(64);
  return {运行:f.run.run_id,检查:check,快照摘要:f.run.snapshot_sha256,输出摘要:f.run.output_sha256,原结论:'pass',复核结论:verdict,理由:'合成测试：撤回原观察，不声称实际看图。',复核者:'合成测试观察者'};
}

test('撤回比例或媒介通过后保留原记录并降低生效计数', t => {
  const f=fixture(t);
  for(const check of ['body-check','medium-check'])for(const verdict of ['fail','uncertain']){
    f.report.review_notes=[reviewNote(f,check,verdict)];
    const before=structuredClone(f.report),r=f.audit({verifyFiles:true}),route=r.routes[0];
    assert.deepEqual(r.errors,[]);
    assert.equal(r.recorded_outputs,1);assert.equal(r.file_verified_outputs,1);
    assert.equal(r.original_consistent_qualified_reports,1);assert.equal(r.consistent_qualified_reports,0);
    assert.equal(r.applied_review_notes,1);assert.equal(route.applied_review_notes,1);
    assert.equal(route.original_body_pass_runs,1);assert.equal(route.original_medium_pass_runs,1);
    assert.equal(route.body_pass_runs,check==='body-check'?0:1);
    assert.equal(route.medium_pass_runs,check==='medium-check'?0:1);
    assert.equal(route.evidence_status,'unresolved');assert.deepEqual(f.report,before);
  }
});

test('复核注记绑定错误不能静默丢弃后继续计通过', t => {
  const f=fixture(t),base=reviewNote(f);
  for(const patch of [{运行:'missing'},{检查:'unknown'},{快照摘要:'b'.repeat(64)},{输出摘要:'c'.repeat(64)},{原结论:'fail'},{复核结论:'pass'},{理由:''},{复核者:''}]){
    f.report.review_notes=[{...base,...patch}];
    const r=f.audit();
    assert.ok(r.errors.some(e=>e.includes('复核注记')));
    assert.equal(r.consistent_qualified_reports,0);assert.equal(r.routes[0].body_pass_runs,0);
    assert.equal(r.routes[0].evidence_status,'invalid');assert.equal(r.recorded_outputs,1);
  }
  for(const notes of [null,{},[base,base]]){f.report.review_notes=notes;assert.ok(f.audit().errors.some(e=>e.includes('复核注记')));}
  f.report.review_notes=[base];delete f.run.snapshot_sha256;
  assert.ok(f.audit().errors.some(e=>e.includes('复核注记')));
});

test('非关键复核保留合格，筛选不把另一运行的撤回转嫁到当前运行', t => {
  const f=fixture(t);
  f.run.checks.push({id:'optional',critical:false,verdict:'pass',evidence:'合成可选观察'});
  f.run.target.acceptance.push({id:'optional',critical:false});
  f.report.review_notes=[reviewNote(f,'optional')];
  assert.equal(f.audit().consistent_qualified_reports,1);
  f.run.case_id='first';
  const other={...structuredClone(f.run),run_id:'two',case_id:'second',output_file:'two.png',output_sha256:'b'.repeat(64)};
  f.report.runs.push(other);f.report.known_completed_calls=2;
  f.report.review_notes=[{...reviewNote(f),运行:'two',输出摘要:other.output_sha256}];
  f.catalog.routes[0].evidence[0].case_id='first';
  const r=f.audit();assert.deepEqual(r.errors,[]);assert.equal(r.consistent_qualified_reports,1);
  assert.equal(r.applied_review_notes,0);assert.equal(r.routes[0].body_pass_runs,1);
  assert.equal(r.recorded_outputs,1);
});
