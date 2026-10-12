import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyFrozenRun} from './production-run.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(root, 'output');
const defaultDirectory = 'output/white-background-reference-cards-20261012';
const cardTypes = ['portrait', 'full_body', 'three_views'];
const independentKind = 'independent_front_full_body';
const isSha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function inside(parent, file) {
  const relative = path.relative(parent, file);
  return relative !== '' && !relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function resolveLocal(value, directory) {
  if (typeof value !== 'string' || !value || value.includes('\0') || /^(https?:|data:|file:)/i.test(value)) return null;
  const normalized = value.replaceAll('\\', '/');
  if (path.isAbsolute(normalized) || /^[a-z]:\//i.test(normalized)) return path.resolve(normalized);
  return path.resolve(normalized.startsWith('output/') ? root : directory, normalized);
}

function hrefFor(file, directory) {
  return path.relative(directory, file).split(path.sep).map(encodeURIComponent).join('/');
}

function digest(file, cache) {
  if (!cache.has(file)) cache.set(file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  return cache.get(file);
}

function actualImage(value, expectedSha, directory, cache, warnings, description) {
  const file = resolveLocal(value, directory);
  if (!file || !inside(outputRoot, file) || !/\.(png|jpe?g|webp|gif)$/i.test(file)) {
    if (value) warnings.push(description + '的本地图片路径不在可服务的 output 目录。');
    return null;
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    warnings.push(description + '的图片文件尚不存在。');
    return null;
  }
  const sha256 = digest(file, cache);
  if (expectedSha && expectedSha !== sha256) {
    warnings.push(description + '的文件 SHA-256 与记录不一致，暂不作为有效候选展示。');
    return null;
  }
  const bytes = fs.readFileSync(file);
  const png = bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return {href: hrefFor(file, directory), sha256, local_path: path.relative(root, file).replaceAll('\\', '/'),
    ...(png ? {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)} : {})};
}

function cardEntry(record, type) {
  const collection = record?.cards ?? record?.outputs ?? record?.derived_cards;
  if (Array.isArray(collection)) return collection.find(card => (card.type ?? card.card_type ?? card.kind ?? card.id) === type);
  return collection?.[type] ?? record?.[type];
}

function reviewDetails(record, generation, board, source, directory, warnings, {snapshot, independent = false} = {}) {
  if (!record) return {status: 'pending', summary: '尚无本版实际图像评审记录。', checks: [], views: [], limitations: []};
  const inspected = record.inspection?.original_pixels_inspected === true && record.inspection?.generated_pixels_inspected === true;
  let valid = Boolean(board && inspected && record.review_kind === 'actual_pixel_review');
  if (record.snapshot_sha256 && generation?.snapshot_sha256 && record.snapshot_sha256 !== generation.snapshot_sha256) valid = false;
  const expectedBoardSha = record.output_sha256 ?? record.generated_image_sha256 ?? record.board_sha256 ?? record.source_board_sha256;
  if (expectedBoardSha && expectedBoardSha !== board?.sha256) valid = false;
  if (record.source_image_sha256 && record.source_image_sha256 !== source?.sha256) valid = false;
  if (record.source_image && source?.local_path) {
    if (resolveLocal(record.source_image, directory) !== path.resolve(root, source.local_path)) valid = false;
  }
  if (record.generated_image && generation) {
    const reviewed = resolveLocal(record.generated_image, directory);
    const actualPaths = [generation.workspace_output, generation.source_output].filter(Boolean).map(value => resolveLocal(value, directory));
    if (!actualPaths.includes(reviewed)) valid = false;
  }
  if (independent) {
    const expected = snapshot?.target?.acceptance;
    const checks = record.checks;
    const protectedChecks = record.scope_review?.preservation_checks;
    valid = valid && isSha(record.snapshot_sha256) && record.snapshot_sha256 === generation.snapshot_sha256 &&
      isSha(expectedBoardSha) && isSha(record.source_image_sha256) && record.source_image_sha256 === source?.sha256 &&
      Array.isArray(expected) && expected.length === 10 && Array.isArray(checks) && checks.length === expected.length &&
      new Set(checks.map(check => check.id)).size === checks.length &&
      expected.every(criterion => checks.some(check => check.id === criterion.id && ['pass', 'fail', 'uncertain', 'not_assessable'].includes(check.verdict) && typeof check.evidence === 'string' && check.evidence.trim())) &&
      snapshot.edit_scope?.preserve?.length === 5 && Array.isArray(protectedChecks) && protectedChecks.length === 5 &&
      new Set(protectedChecks.map(check => check.index)).size === 5 &&
      protectedChecks.every(check => Number.isSafeInteger(check.index) && check.index >= 0 && check.index < 5 &&
        ['pass', 'fail', 'uncertain', 'not_assessable'].includes(check.verdict) && typeof check.evidence === 'string' && check.evidence.trim());
  }
  if (!valid) warnings.push(independent ? '独立全身卡评审未完整绑定本次输出、原图及其 10 项检查 / 5 项保持范围，状态保留待审。' : '评审文件尚未确认绑定本版实际板图及原图，状态保留待审。');
  return {
    status: valid ? 'reviewed' : 'pending',
    summary: valid ? (record.summary || '已记录实际像素检查；逐项结论见评审文件。') : '已有评审文件，但其实际像素检查或版本绑定尚未确认。',
    target_scope: record.inspection?.target_scope || '',
    checks: valid ? (record.checks || []).map(check => ({id: check.id, label: check.label || '', verdict: check.verdict, evidence: check.evidence || ''})) : [],
    preservation_checks: valid ? (record.scope_review?.preservation_checks || []).map(check => ({index: check.index, verdict: check.verdict, evidence: check.evidence || ''})) : [],
    views: valid ? (record.per_view_review || []).map(view => ({view: view.view, direction: view.direction ?? view.direction_verdict, visible_identity: view.visible_identity ?? view.visible_identity_verdict, visible_makeup: view.visible_makeup ?? view.makeup_verdict, proportion: view.proportion_verdict, medium: view.medium_verdict, costume: view.costume_verdict, evidence: view.evidence || ''})) : [],
    limitations: valid && Array.isArray(record.limitations) ? record.limitations : [],
    qualified: valid && record.qualified === true,
    user_accepted: valid && record.user_accepted === true
  };
}

function independentCard(entry, original, source, directory, cache, warnings, independentHashes) {
  try {
    const receiptFile = resolveLocal(entry.generation_receipt, directory);
    if (!receiptFile || !inside(outputRoot, receiptFile) || !receiptFile.endsWith('.generation.json') || !fs.existsSync(receiptFile)) throw Error('缺少本地独立生成记录');
    const generation = readJson(receiptFile);
    if (generation.asset_kind !== independentKind || generation.actual_image_generated !== true || generation.id !== original.id ||
        !isSha(generation.output_sha256) || !isSha(generation.snapshot_sha256) || !isSha(entry.sha256 ?? entry.output_sha256) ||
        (entry.sha256 ?? entry.output_sha256) !== generation.output_sha256 || !isSha(entry.snapshot_sha256) || entry.snapshot_sha256 !== generation.snapshot_sha256) throw Error('独立生成类型、源编号或输出 / 快照摘要不匹配');
    const snapshotFile = receiptFile.replace(/\.generation\.json$/, '.snapshot.json');
    if (!fs.existsSync(snapshotFile)) throw Error('缺少独立生成的冻结快照');
    const snapshot = readJson(snapshotFile);
    verifyFrozenRun(snapshot);
    if (snapshot.snapshot_sha256 !== generation.snapshot_sha256 || snapshot.case_id !== original.id || snapshot.target?.subject_kind !== 'character') throw Error('独立卡快照未绑定当前来源');
    const inputs = generation.actual_inputs;
    const hashes = generation.actual_input_sha256;
    if (!Array.isArray(inputs) || !Array.isArray(hashes) || inputs.length !== snapshot.actual_inputs.length || hashes.length !== inputs.length ||
        !inputs.every((value, index) => resolveLocal(value, directory) === resolveLocal(snapshot.actual_inputs[index].source, directory) && hashes[index] === snapshot.actual_inputs[index].content_sha256)) throw Error('独立卡实际输入与冻结输入不一致');
    const identities = snapshot.references.filter(reference => reference.authority?.includes('identity'));
    const originPath = resolveLocal(original.source?.local_path, directory);
    if (!source || identities.length !== 1 || identities[0].content_sha256 !== source.sha256 || resolveLocal(identities[0].source, directory) !== originPath ||
        !inputs.some((value, index) => resolveLocal(value, directory) === originPath && hashes[index] === source.sha256) ||
        ((entry.original_source_sha256 ?? entry.source_sha256) !== undefined && (entry.original_source_sha256 ?? entry.source_sha256) !== source.sha256)) throw Error('独立卡的唯一原身份输入 / 原源摘要不一致');
    const generated = actualImage(generation.workspace_output, generation.output_sha256, directory, cache, warnings, '独立全身生成输出');
    const image = actualImage(entry.path ?? entry.local_path ?? entry.workspace_output, generation.output_sha256, directory, cache, warnings, '独立全身卡');
    if (!generated || !image) return null;
    if (image.width && image.height && image.width >= image.height) throw Error('独立正面全身卡不是声明的竖幅输出');
    independentHashes.add(generated.sha256);
    const declaredReview = entry.review_receipt ?? entry.review_file;
    const reviewFile = declaredReview ? resolveLocal(declaredReview, directory) : receiptFile.replace(/\.generation\.json$/, '.review.json');
    const hasReview = reviewFile && inside(outputRoot, reviewFile) && reviewFile.endsWith('.review.json') && fs.existsSync(reviewFile);
    let reviewRecord = null;
    if (hasReview) {
      try { reviewRecord = readJson(reviewFile); }
      catch { warnings.push('独立全身卡评审文件无法读取，保留实际卡片及待审状态。'); }
    }
    const review = reviewDetails(reviewRecord, generation, image, source, directory, warnings, {snapshot, independent: true});
    const promptFile = resolveLocal(entry.prompt_file, directory);
    return {...image, crop: null, origin_kind: 'independent_generated_card', source_sha256: source.sha256,
      snapshot_sha256: generation.snapshot_sha256, generation_stem: generation.stem,
      records: {generation: hrefFor(receiptFile, directory), snapshot: hrefFor(snapshotFile, directory),
        prompt: promptFile && inside(outputRoot, promptFile) && fs.existsSync(promptFile) ? hrefFor(promptFile, directory) : null,
        review: hasReview ? hrefFor(reviewFile, directory) : null}, review};
  } catch (error) {
    warnings.push('独立全身卡来源校验未通过：' + error.message + '；不作为有效卡片展示。');
    return null;
  }
}

/** Read existing records and files. This does not generate, crop, or rewrite images. */
export function readWhiteReferenceCardGallery(outputDirectory = defaultDirectory) {
  const directory = path.resolve(root, outputDirectory);
  if (!inside(outputRoot, directory)) throw Error('gallery must be built in a child directory of project output');
  const scope = readJson(path.join(directory, 'scope.json'));
  const originals = scope.original_sources32 ?? scope.original_sources;
  if (!Array.isArray(originals) || originals.length !== 32) throw Error('scope must retain exactly 32 original source records');
  if (new Set(originals.map(source => source.id)).size !== originals.length) throw Error('duplicate source IDs in scope');

  const planCandidates = ['skill-studio-dispatch-plan.json', 'active-dispatch-plan.json', 'studio-dispatch-plan.json', 'dispatch-plan.json'];
  const planFile = planCandidates.find(file => fs.existsSync(path.join(directory, file)));
  const plan = planFile ? readJson(path.join(directory, planFile)) : {items: []};
  const planById = new Map((plan.items || []).map(item => [item.id, item]));
  const records = new Map();
  for (const filename of fs.readdirSync(directory).sort()) {
    const match = filename.match(/^(.*)\.(generation|cards|review)\.json$/);
    if (!match) continue;
    const stem = match[1], kind = match[2];
    if (!records.has(stem)) records.set(stem, {});
    records.get(stem)[kind] = {record: readJson(path.join(directory, filename)), href: encodeURIComponent(filename), file: path.join(directory, filename)};
  }

  const cache = new Map();
  const allBoardHashes = new Set();
  const currentBoardHashes = new Set();
  const allIndependentHashes = new Set();
  const declaredIndependentHashes = new Set([...records.values()].filter(entry => entry.generation?.record.asset_kind === independentKind)
    .map(entry => entry.generation.record.output_sha256).filter(isSha));
  let verifiedOriginals = 0;
  const rows = originals.map(original => {
    const warnings = [];
    const source = original.source || {};
    const originalFile = resolveLocal(source.local_path, directory);
    if (originalFile && fs.existsSync(originalFile) && digest(originalFile, cache) !== source.sha256) throw Error('original content changed: ' + original.id);
    const originalImage = actualImage(source.local_path, source.sha256, directory, cache, warnings, '原图');
    if (originalImage) verifiedOriginals++;
    const target = planById.get(original.id);
    const currentStem = target?.stem || original.id + '-skill-studio-v1';
    const sourceStems = [...records.keys()].filter(stem => stem === original.id || stem.startsWith(original.id + '-'));
    for (const stem of sourceStems) {
      const entry = records.get(stem).generation;
      if (entry?.record.asset_kind !== independentKind) continue;
      const generation = entry.record;
      independentCard({path: generation.workspace_output, sha256: generation.output_sha256,
        snapshot_sha256: generation.snapshot_sha256, original_source_sha256: source.sha256, generation_receipt: entry.file},
      original, originalImage, directory, cache, warnings, allIndependentHashes);
    }
    const stems = [currentStem, ...sourceStems.filter(stem => stem !== currentStem && records.get(stem).generation?.record.asset_kind !== independentKind)];
    const versions = stems.map(stem => {
      const versionWarnings = [];
      const entries = records.get(stem) || {};
      const generation = entries.generation?.record;
      const declaredActual = generation && generation.actual_image_generated !== false && generation.asset_kind !== independentKind;
      let board = declaredActual ? actualImage(generation.workspace_output, generation.output_sha256, directory, cache, versionWarnings, '板图') : null;
      if (board?.width && board.height && board.width < board.height) {
        versionWarnings.push('竖幅单图不作为横向四格板图或板图生成次数。');
        board = null;
      }
      if (board) {
        allBoardHashes.add(board.sha256);
        if (stem === currentStem) currentBoardHashes.add(board.sha256);
      }
      const cardRecord = entries.cards?.record;
      const boardSha = cardRecord?.source_board_sha256 ?? cardRecord?.board_sha256 ?? cardRecord?.source_board?.sha256 ?? cardRecord?.board?.sha256;
      const lineageMatches = Boolean(board && cardRecord && boardSha === board.sha256);
      if (cardRecord && !lineageMatches) versionWarnings.push('派生卡记录尚未确认来自本版板图，暂不列为真实可下载卡片。');
      const cards = {};
      for (const type of cardTypes) {
        const entry = cardEntry(cardRecord, type);
        if (!entry) continue;
        if (entry.origin_kind === 'independent_generated_card') {
          if (type !== 'full_body') { versionWarnings.push('独立正面全身生成不能冒充肖像或三视图裁切卡。'); continue; }
          const image = independentCard(entry, original, originalImage, directory, cache, versionWarnings, allIndependentHashes);
          if (image && image.sha256 !== board?.sha256) cards[type] = image;
          else if (image) versionWarnings.push('独立全身输出不能与本版四格板图使用相同文件内容。');
          continue;
        }
        if (entry.origin_kind && !['board_derived_card', 'safe_board_crop'].includes(entry.origin_kind)) { versionWarnings.push('未知卡片来源类型，暂不作为有效卡片展示。'); continue; }
        if (!lineageMatches) continue;
        const rawPath = typeof entry === 'string' ? entry : (entry.path ?? entry.local_path ?? entry.workspace_output ?? entry.output_path ?? entry.file);
        const image = actualImage(rawPath, entry.sha256 ?? entry.output_sha256, directory, cache, versionWarnings, type + ' 卡片');
        if (image && declaredIndependentHashes.has(image.sha256)) { versionWarnings.push('独立生成输出不能省略来源类型后冒充同板裁切卡。'); continue; }
        if (image) cards[type] = {...image, crop: entry.crop ?? entry.crop_rectangle ?? entry.crop_rect ?? null,
          origin_kind: 'board_derived_card', source_board_sha256: board.sha256};
      }
      const review = reviewDetails(entries.review?.record, generation, board, originalImage, directory, versionWarnings);
      const independentCards = Object.values(cards).filter(card => card.origin_kind === 'independent_generated_card');
      const independentOutputs = new Set(independentCards.map(card => card.sha256)).size;
      const provenance = {kind: independentCards.length ? 'mixed' : 'board_derived', reference_card_count: Object.keys(cards).length,
        derived_card_count: Object.values(cards).filter(card => card.origin_kind === 'board_derived_card').length,
        independent_card_count: independentCards.length, model_calls_for_group: (board ? 1 : 0) + independentOutputs,
        board_review_status: review.status, independent_review_status: independentCards.length ? (independentCards.every(card => card.review.status === 'reviewed') ? 'reviewed' : 'pending') : 'not_applicable',
        consistency_review_status: independentCards.length ? 'pending' : 'board_review_scope',
        costume_version_changed: cardRecord?.clothing_version_consistent === false,
        note: typeof cardRecord?.group_note === 'string' && cardRecord.group_note.trim() ? cardRecord.group_note : independentCards.length ? '本组包含同板裁切与另一轮独立全身生成；板图评审不适用于独立卡，两轮之间的衣装、比例和尺度一致性仍待复核。' : '本组卡片为同一板图裁切，不增加模型调用次数。'};
      const dispatchStatus = stem === currentStem ? target?.dispatch_status || 'not_started' : 'historical';
      const status = board ? (review.status === 'reviewed' && !independentCards.length ? 'reviewed' : 'candidate') : (['started', 'in_progress', 'dispatched', 'running'].includes(dispatchStatus) ? 'generating' : 'not_dispatched');
      return {stem, current: stem === currentStem, status, dispatch_status: dispatchStatus, board, cards, review, provenance,
        records: {generation: entries.generation?.href || null, cards: entries.cards?.href || null, review: entries.review?.href || null}, warnings: versionWarnings};
    });
    return {id: original.id, title: original.title || original.id, medium: original.medium || 'unknown', identity_preset_id: original.identity_preset_id || null,
      source: {...source, image: originalImage}, current_stem: currentStem, current_status: versions[0].status, versions, warnings};
  });
  const currentVersions = rows.map(row => row.versions[0]);
  return {
    schema_version: 1, built_at: new Date().toISOString(), source_count: rows.length, active_plan: planFile || null,
    totals: {verified_originals: verifiedOriginals, current_sources_with_board: currentVersions.filter(version => version.board).length,
      current_sources_reviewed: currentVersions.filter(version => version.status === 'reviewed').length,
      current_board_reviews: currentVersions.filter(version => version.board && version.review.status === 'reviewed').length,
      current_independent_reviews: currentVersions.reduce((sum, version) => sum + Object.values(version.cards)
        .filter(card => card.origin_kind === 'independent_generated_card' && card.review.status === 'reviewed').length, 0),
      current_reference_cards: currentVersions.reduce((sum, version) => sum + Object.keys(version.cards).length, 0),
      current_derived_cards: currentVersions.reduce((sum, version) => sum + version.provenance.derived_card_count, 0),
      current_independent_cards: currentVersions.reduce((sum, version) => sum + version.provenance.independent_card_count, 0),
      actual_independent_card_images: allIndependentHashes.size, actual_model_outputs: allBoardHashes.size + allIndependentHashes.size,
      actual_board_images_including_previous: allBoardHashes.size, previous_board_images: [...allBoardHashes].filter(hash => !currentBoardHashes.has(hash)).length},
    counting_boundary: '准备版不计出图；同板裁切不增加模型调用。独立全身卡按其自己的生成记录另计一次输出，不计为四格板图，也不继承板图的评审通过。',
    originals_overwritten: false, historical_targets_regraded: false, rows
  };
}

export function buildWhiteReferenceCardGallery(outputDirectory = defaultDirectory) {
  const directory = path.resolve(root, outputDirectory);
  const data = readWhiteReferenceCardGallery(outputDirectory);
  fs.copyFileSync(path.join(root, 'assets/white-background-reference-cards.html'), path.join(directory, 'gallery.html'));
  fs.writeFileSync(path.join(directory, 'gallery-data.json'), JSON.stringify(data, null, 2) + '\n');
  const report = {directory, source_count: data.source_count, ...data.totals, original_images_modified: false, image_generation_performed: false};
  fs.writeFileSync(path.join(directory, 'gallery-build.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3) throw Error('usage: build-white-reference-card-gallery.mjs [output/child-directory]');
    console.log(JSON.stringify(buildWhiteReferenceCardGallery(process.argv[2]), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
