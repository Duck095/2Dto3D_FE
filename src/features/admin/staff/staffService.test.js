import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ENDPOINTS } from '../../../services/api/endpoints.js';

const service = await readFile(new URL('./staffService.js', import.meta.url), 'utf8').catch(error => {
  if (error.code === 'ENOENT') return '';
  throw error;
});

test('staff endpoint registry matches BE-02 paths without duplicating the /api base prefix', () => {
  assert.equal(ENDPOINTS.STAFF.LIST, '/admin/staff');
  assert.equal(ENDPOINTS.STAFF.CREATE, '/admin/staff');
  assert.equal(ENDPOINTS.STAFF.DETAIL(17), '/admin/staff/17');
  assert.equal(ENDPOINTS.STAFF.UPDATE(17), '/admin/staff/17');
  assert.equal(ENDPOINTS.STAFF.STATUS(17), '/admin/staff/17/status');
});

test('staff service routes every operation through the shared apiClient and endpoint registry', () => {
  assert.match(service, /import apiClient from ['"].*apiClient/);
  assert.match(service, /import \{ ENDPOINTS \} from ['"].*endpoints/);
  assert.match(service, /apiClient\.get\(ENDPOINTS\.STAFF\.LIST/);
  assert.match(service, /apiClient\.post\(ENDPOINTS\.STAFF\.CREATE/);
  assert.match(service, /apiClient\.get\(ENDPOINTS\.STAFF\.DETAIL\(id\)/);
  assert.match(service, /apiClient\.patch\(ENDPOINTS\.STAFF\.UPDATE\(id\)/);
  assert.match(service, /apiClient\.patch\(ENDPOINTS\.STAFF\.STATUS\(id\)/);
  assert.doesNotMatch(service, /axios\.create|['"]\/api\/admin\/staff/);
});
