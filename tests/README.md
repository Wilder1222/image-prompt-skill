# Verification

The production workflow is now `prompt-build` / `prompt-review`. Tests cover source authority, reference inspection declarations, visible-versus-inferred locks, required-instruction coverage, missing acceptance criteria, unfinished clauses, exact prompt hashes and uncertain image reviews. Legacy `asset-prompt` emits `scaffold_only` because it has no reference-specific visual analysis.

These checks validate declared data and artifact integrity. They cannot prove that the agent interpreted the image correctly or that a prompt will yield a good image. The host agent must inspect actual inputs, review the meaning of the final prompt, then inspect actual outputs when generation is requested.

The v0.12 production-run tests cover immutable run snapshots, exact reference order and content hashes, output/target binding, same-person supporting views, scoped category edits, user changes to stance and shoe visibility, changed-goal exclusion, duplicate outputs, interrupted queues with unknown dispatch, and same-goal repair statistics. The compatibility asset case now allows natural footwear occlusion. These are contract tests, not visual anatomy or pose recognition.

Run `npm test` for the Node.js test suite and `npm run validate` for catalog, skill-entrypoint, linked-file, JSON, reference-binding and release-hash validation. No npm dependencies are required.

After editing prompt catalogs or the compiler, run `npm run examples:build` to regenerate current examples and the plan. After completing intended file changes, run `npm run release:build` to update the current manifest, then `npm run validate`. Keep versioned historical manifests unchanged.

The current tests exercise face A/B isolation, effective age preservation, hand overrides, copyable text output, explicit edit locks, narrow repair scopes, rejected conflicting passed dimensions, invalid CLI arguments, and legacy command compatibility. Published current examples must equal compiler output.

The v0.8.4 cases also verify presentation selection without face/material drift, user hand-pose priority, local-repair isolation, full-body anchor preservation without hidden preset application, rejected conflicting anchor overrides, CLI dispatch, and presentation catalog validation.

Release tests mutate temporary copies to verify missing entrypoints, broken links, invalid preset references, changed file content and unlisted files are detected. Temporary copies are removed after each test.

Existing suites cover earlier reference-role, style, proportion, human-presence and diagnostic routing behavior. These tests do not inspect images, measure identity similarity, or establish visual quality or batch reliability.

Production-run tests also cover the independent background channel: retained, adjusted, replaced and white backgrounds; background-only edits preserve lighting and identity, and environment references cannot acquire identity authority implicitly. These are compilation and scope checks, not rendered scene-quality evidence.

Expression checks cover independent expression-reference authority and scoped expression edits: identity, age instructions, appearance, composition, background and lighting remain outside an expression-only update. They do not establish visual identity preservation under a changed expression.

Action checks cover action-reference permissions and coordinated changes to movement, expression, composition, visible extremities and material response while preserving identity and wardrobe. A change from standing to airborne uses a new target, not a silent relaxation of the old stance check. These checks do not judge anatomy or liveliness in rendered images.

Use `templates/visual-regression-record.json` for actual image evaluation. Do not mark image checks passed from CLI output alone.

Use `templates/benchmark-comparison-record.json` when the user supplies a better reference. Record whether the benchmark was only inspected to write the prompt or actually sent to the image model. Keep observer review and user approval separate.

The v0.9.0 plugin tests cover standard skill discovery, canonical metadata synchronization, manifest/path/version drift, official cachebuster preservation, compilation from an isolated installed directory, clean rebuilds, stale-source refusal, preservation of edited build outputs, and exclusion of generated files and credentials. `npm run release:build` synchronizes the plugin before updating hashes. Run `npm run plugin:build` to verify the complete portable plugin directory.
