import assert from 'node:assert/strict';
import test from 'node:test';
import {
    MAX_AUTOMATIC_PIPELINE_READS,
    PIPELINE_POLL_INTERVAL_MS,
    classifyPipelineReadError,
    getPipelineJobFailureMessage,
    getPipelineStatusLabel,
    getProjectPipelineStateForOwner,
    hasActivePipelineJobs,
    normalizeProjectPipeline,
    shouldContinuePipelinePolling,
} from './pipelinePresentation.js';

const timestamp = '2026-11-17T03:00:00Z';
const emptyPipeline = (projectId = 'project-1') => ({
    projectId,
    projectStatus: 'DRAFT',
    referenceVersions: [],
    modelVersions: [],
    jobs: [],
});

function populatedPipeline(projectId = 'project-1') {
    return {
        projectId,
        projectStatus: 'MODEL_GENERATING',
        referenceVersions: [
            { versionId: 'ref-1', versionNumber: 1, status: 'APPROVED', availableViews: ['front', 'left'], parentVersionId: null, createdAt: timestamp },
            { versionId: 'ref-2', versionNumber: 2, status: 'READY_FOR_REVIEW', availableViews: ['front', 'back'], parentVersionId: 'ref-1', createdAt: timestamp },
        ],
        modelVersions: [
            { modelVersionId: 'model-1', versionNumber: 1, referenceVersionId: 'ref-1', status: 'CHANGES_REQUESTED', supersedesModelVersionId: null, artifactAvailable: false, createdAt: timestamp },
            { modelVersionId: 'model-2', versionNumber: 2, referenceVersionId: 'ref-2', status: 'READY_FOR_REVIEW', supersedesModelVersionId: 'model-1', artifactAvailable: true, createdAt: timestamp },
        ],
        jobs: [
            { jobId: 'job-1', stage: 'REFERENCE_GENERATION', status: 'PENDING', safeErrorCode: null, attemptCount: 0, createdAt: timestamp, updatedAt: timestamp },
            { jobId: 'job-2', stage: 'MODEL_GENERATION', status: 'PROCESSING', safeErrorCode: null, attemptCount: 2, createdAt: timestamp, updatedAt: timestamp },
        ],
    };
}

test('accepts a valid empty Pipeline and preserves empty arrays without invented results', () => {
    assert.deepEqual(normalizeProjectPipeline(emptyPipeline(), 'project-1'), {
        ...emptyPipeline(), referenceVersions: [], modelVersions: [], jobs: [],
    });
});

test('normalizes multiple versions and jobs without inferring job-to-version associations', () => {
    const pipeline = normalizeProjectPipeline(populatedPipeline(), 'project-1');
    assert.equal(pipeline.referenceVersions.length, 2);
    assert.equal(pipeline.modelVersions.length, 2);
    assert.equal(pipeline.jobs.length, 2);
    assert.deepEqual(pipeline.jobs.map(job => Object.keys(job)), [
        ['jobId', 'stage', 'status', 'safeErrorCode', 'attemptCount', 'createdAt', 'updatedAt'],
        ['jobId', 'stage', 'status', 'safeErrorCode', 'attemptCount', 'createdAt', 'updatedAt'],
    ]);
    assert.equal(pipeline.modelVersions[1].referenceVersionId, 'ref-2');
});

test('orders versions by contract versionNumber rather than Backend array order', () => {
    const input = populatedPipeline();
    input.referenceVersions.reverse();
    input.modelVersions.reverse();
    const pipeline = normalizeProjectPipeline(input, 'project-1');
    assert.deepEqual(pipeline.referenceVersions.map(version => version.versionNumber), [1, 2]);
    assert.deepEqual(pipeline.modelVersions.map(version => version.versionNumber), [1, 2]);
});

test('rejects duplicate version numbers that would make latest selection ambiguous', () => {
    const input = populatedPipeline();
    input.referenceVersions[1] = { ...input.referenceVersions[1], versionNumber: 1 };
    assert.equal(normalizeProjectPipeline(input, 'project-1'), null);
    const modelInput = populatedPipeline();
    modelInput.modelVersions[1] = { ...modelInput.modelVersions[1], versionNumber: 1 };
    assert.equal(normalizeProjectPipeline(modelInput, 'project-1'), null);
});

test('accepts nullable DTO fields without inventing replacement values', () => {
    const input = populatedPipeline();
    input.referenceVersions[0].parentVersionId = null;
    input.modelVersions[0].supersedesModelVersionId = null;
    input.jobs[0].safeErrorCode = null;
    const pipeline = normalizeProjectPipeline(input, 'project-1');
    assert.equal(pipeline.referenceVersions[0].parentVersionId, null);
    assert.equal(pipeline.modelVersions[0].supersedesModelVersionId, null);
    assert.equal(pipeline.jobs[0].safeErrorCode, null);
});

test('rejects a mismatched project ID and missing required arrays', () => {
    assert.equal(normalizeProjectPipeline(emptyPipeline('foreign-project'), 'project-1'), null);
    for (const field of ['referenceVersions', 'modelVersions', 'jobs']) {
        const malformed = emptyPipeline();
        delete malformed[field];
        assert.equal(normalizeProjectPipeline(malformed, 'project-1'), null, `${field} is required`);
    }
});

test('rejects malformed version and job fields rather than accepting partial Pipeline success', () => {
    const mutations = [
        p => { p.referenceVersions = [null]; },
        p => { p.referenceVersions = [{ ...populatedPipeline().referenceVersions[0], versionNumber: 0 }]; },
        p => { p.referenceVersions = [{ ...populatedPipeline().referenceVersions[0], availableViews: 'front' }]; },
        p => { p.modelVersions = [{ ...populatedPipeline().modelVersions[0], artifactAvailable: 'yes' }]; },
        p => { p.jobs = [{ ...populatedPipeline().jobs[0], attemptCount: -1 }]; },
        p => { p.jobs = [{ ...populatedPipeline().jobs[0], updatedAt: 'not-a-date' }]; },
    ];
    for (const mutate of mutations) {
        const input = emptyPipeline();
        mutate(input);
        assert.equal(normalizeProjectPipeline(input, 'project-1'), null);
    }
});

test('keeps unknown statuses unrecognized and never interprets them as completion', () => {
    const input = populatedPipeline();
    input.projectStatus = 'FUTURE_STATE';
    input.jobs = [{ ...input.jobs[0], status: 'FUTURE_JOB_STATE' }];
    const pipeline = normalizeProjectPipeline(input, 'project-1');
    assert.equal(pipeline.projectStatus, 'FUTURE_STATE');
    assert.equal(getPipelineStatusLabel('FUTURE_STATE', 'project'), 'Trạng thái chưa nhận diện');
    assert.equal(getPipelineStatusLabel('FUTURE_JOB_STATE', 'job'), 'Trạng thái chưa nhận diện');
    assert.equal(hasActivePipelineJobs(pipeline), false);
});

test('polls only for PENDING or PROCESSING jobs', () => {
    for (const status of ['PENDING', 'PROCESSING']) {
        const pipeline = normalizeProjectPipeline({ ...emptyPipeline(), jobs: [{
            jobId: 'job-active', stage: 'MODEL_GENERATION', status, safeErrorCode: null,
            attemptCount: 1, createdAt: timestamp, updatedAt: timestamp,
        }] }, 'project-1');
        assert.equal(hasActivePipelineJobs(pipeline), true);
    }
    for (const status of ['COMPLETED', 'FAILED', 'CANCELLED']) {
        const pipeline = normalizeProjectPipeline({ ...emptyPipeline(), jobs: [{
            jobId: 'job-done', stage: 'MODEL_GENERATION', status, safeErrorCode: null,
            attemptCount: 1, createdAt: timestamp, updatedAt: timestamp,
        }] }, 'project-1');
        assert.equal(hasActivePipelineJobs(pipeline), false);
    }
    assert.equal(PIPELINE_POLL_INTERVAL_MS, 8000);
    assert.equal(MAX_AUTOMATIC_PIPELINE_READS, 15);
});

test('polling decision stops at the configured budget or when the page is hidden', () => {
    const active = normalizeProjectPipeline({ ...emptyPipeline(), jobs: [{
        jobId: 'job-active', stage: 'MODEL_GENERATION', status: 'PROCESSING', safeErrorCode: null,
        attemptCount: 1, createdAt: timestamp, updatedAt: timestamp,
    }] }, 'project-1');
    assert.equal(shouldContinuePipelinePolling(active, 0, true), true);
    assert.equal(shouldContinuePipelinePolling(active, MAX_AUTOMATIC_PIPELINE_READS - 1, true), true);
    assert.equal(shouldContinuePipelinePolling(active, MAX_AUTOMATIC_PIPELINE_READS, true), false);
    assert.equal(shouldContinuePipelinePolling(active, 0, false), false);
    assert.equal(shouldContinuePipelinePolling(emptyPipeline(), 0, true), false);
});

test('renders only validated safe error codes and a neutral fallback', () => {
    assert.equal(getPipelineJobFailureMessage({ status: 'FAILED', safeErrorCode: 'PROVIDER_TIMEOUT' }), 'Mã lỗi: PROVIDER_TIMEOUT');
    assert.equal(getPipelineJobFailureMessage({ status: 'FAILED', safeErrorCode: 'SQL: private detail' }), 'Backend báo công việc thất bại.');
    assert.equal(getPipelineJobFailureMessage({ status: 'PROCESSING', safeErrorCode: null }), null);
});

test('classifies pipeline read errors without surfacing internal messages', () => {
    assert.equal(classifyPipelineReadError({ response: { status: 401 } }).phase, 'auth-required');
    for (const status of [403, 404]) assert.equal(classifyPipelineReadError({ response: { status } }).phase, 'unavailable');
    assert.equal(classifyPipelineReadError({ response: { status: 400, data: { code: 'FEATURE_DISABLED' } } }).phase, 'unavailable');
    assert.equal(classifyPipelineReadError({ response: { status: 409 } }).phase, 'error');
    assert.equal(classifyPipelineReadError({ response: { status: 429 } }).phase, 'error');
    assert.equal(classifyPipelineReadError({ response: { status: 503, data: { message: 'internal stack' } } }).message.includes('internal stack'), false);
    assert.equal(classifyPipelineReadError({ code: 'ERR_NETWORK' }).phase, 'error');
});

test('hides private Pipeline state when owner or confirmed project differs', () => {
    const state = { ownerKey: 'user-a:session-1', projectId: 'project-1', phase: 'ready', pipeline: populatedPipeline() };
    assert.equal(getProjectPipelineStateForOwner(state, 'user-a:session-1', 'project-1'), state);
    assert.equal(getProjectPipelineStateForOwner(state, 'user-b:session-2', 'project-1').pipeline, null);
    assert.equal(getProjectPipelineStateForOwner(state, 'user-a:session-1', 'project-2').pipeline, null);
    assert.equal(getProjectPipelineStateForOwner(state, 'user-a:session-1', '').pipeline, null);
});
