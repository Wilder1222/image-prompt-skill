import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectText} from '../scripts/audit-language.mjs';
test('commands and protocol identifiers are not prose, while text prompts inside fences still are',()=>{
  const text='# 中文标题\n```bash\nnpm run examples:build\n```\n`P9_FASHION_ASSET`\n```text\nKeep the whole figure inside the frame.\n```';
  const rows=inspectText('a.md',text);assert.equal(rows.length,1);assert.match(rows[0].内容,/Keep the/);
});
test('English content cannot be hidden with a Chinese prefix or a JSON key',()=>{
  assert.equal(inspectText('a.md','中文说明：Keep the face and costume unchanged.').length,1);
  const rows=inspectText('a.json',JSON.stringify({说明:'Keep the face and costume unchanged.',profile:'P9_FASHION_ASSET'}));assert.equal(rows.length,1);assert.equal(rows[0].位置,'$.说明');
});
