import assert from 'node:assert/strict';
import test from 'node:test';
import {
    classifyProjectHistoryError,
    getProjectHistoryStateForOwner,
    mergeDesignProjectHistoryPages,
    normalizeDesignProjectHistoryPage,
} from './projectHistoryPresentation.js';

const project = (projectId, extra = {}) => ({
    projectId,
    productType: 'figure',
    keychainVariant: null,
    styleId: 'chibi-collectible',
    inputMode: 'text',
    originalIdea: 'A small bird',
    status: 'DRAFT',
    createdAt: '2026-11-18T10:00:00Z',
    updatedAt: '2026-11-18T10:05:00Z',
    latestReferenceVersionId: null,
    latestModelVersionId: null,
    ...extra,
});

const page = (content, extra = {}) => ({
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length ? 1 : 0,
    first: true,
    last: true,
    ...extra,
});

test('Project History page normalization preserves exact Backend states and valid summaries', () => {
    const normalized = normalizeDesignProjectHistoryPage(page([project('project-a', { status: 'NEW_BACKEND_STATE' })]), 0);
    assert.equal(normalized.content[0].projectId, 'project-a');
    assert.equal(normalized.content[0].status, 'NEW_BACKEND_STATE');
    assert.equal(normalized.content[0].latestModelVersionId, null);
    assert.equal(normalizeDesignProjectHistoryPage(page([project('project-b', { updatedAt: 'invalid-date' })]), 0).content[0].updatedAt, null);
});

test('Project History page rejects malformed paging metadata or incomplete summary identity', () => {
    assert.equal(normalizeDesignProjectHistoryPage(page([project('project-a')]), 1), null);
    assert.equal(normalizeDesignProjectHistoryPage(page([project('')]), 0), null);
    assert.equal(normalizeDesignProjectHistoryPage(page([project('project-a', { status: '' })]), 0), null);
    assert.equal(normalizeDesignProjectHistoryPage(page([], { last: false }), 0), null);
});

test('Project History pagination merges pages by projectId and keeps the newest Backend summary', () => {
    const first = project('project-a');
    const duplicateUpdated = project('project-a', { updatedAt: '2026-11-18T10:10:00Z', status: 'MODEL_REVIEW' });
    const merged = mergeDesignProjectHistoryPages([first], [duplicateUpdated, project('project-b')]);
    assert.deepEqual(merged.map((item) => item.projectId), ['project-a', 'project-b']);
    assert.equal(merged[0].status, 'MODEL_REVIEW');
});

test('Project History owner state hides prior-account data and classifies auth errors', () => {
    const previous = { ownerKey: 'account-a:session-1', phase: 'ready', items: [project('private-a')] };
    assert.deepEqual(getProjectHistoryStateForOwner(previous, 'account-b:session-2').items, []);
    assert.equal(getProjectHistoryStateForOwner(previous, 'account-a:session-1'), previous);
    assert.equal(classifyProjectHistoryError({ response: { status: 401 } }).phase, 'auth-required');
    assert.equal(classifyProjectHistoryError({ response: { status: 403 } }).phase, 'forbidden');
    assert.equal(classifyProjectHistoryError({ code: 'ERR_NETWORK' }).phase, 'error');
});
