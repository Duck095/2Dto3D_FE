import assert from 'node:assert/strict';
import test from 'node:test';
import { isDesignProjectPrintDraft, matchesDesignProjectPrintDraft, normalizeAIStudioPrintReadiness } from './printReadinessPresentation.js';

const validReady = {
    projectId: 'project-1',
    modelVersionId: 'model-2',
    projectStatus: 'COMPLETED',
    modelStatus: 'APPROVED',
    artifactAvailable: true,
    artifactSha256: 'a'.repeat(64),
    printReadiness: 'READY',
    reasonCode: null,
    xMm: 42.25,
    yMm: 28.5,
    zMm: 12.125,
    dimensionUnit: 'mm',
    dimensionSource: 'trusted-measurement-service',
    dimensionMethod: 'mesh-bounds-v1',
    measurementModelVersionId: 'model-2',
    measurementArtifactSha256: 'a'.repeat(64),
    measuredAt: '2026-11-19T10:30:00Z',
    provenanceId: 'measurement-1',
};

test('accepts READY only when dimensions and measurement provenance match the artifact version', () => {
    const result = normalizeAIStudioPrintReadiness(validReady, 'project-1', 'model-2');
    assert.equal(result.phase, 'ready');
    assert.deepEqual(result.dimensionsMm, { x: 42.25, y: 28.5, z: 12.125 });
    assert.equal(result.provenanceId, 'measurement-1');
});

test('preserves NOT_READY reason without exposing uncertified dimensions', () => {
    const result = normalizeAIStudioPrintReadiness({
        ...validReady,
        printReadiness: 'NOT_READY',
        reasonCode: 'MEASUREMENT_UNAVAILABLE',
        xMm: null,
        yMm: null,
        zMm: null,
        dimensionSource: null,
        dimensionMethod: null,
        measurementModelVersionId: null,
        measurementArtifactSha256: null,
        measuredAt: null,
        provenanceId: null,
    }, 'project-1', 'model-2');
    assert.equal(result.phase, 'not-ready');
    assert.equal(result.reasonCode, 'MEASUREMENT_UNAVAILABLE');
    assert.equal(result.dimensionsMm, null);
});

test('fails closed for mismatched identity, checksum, missing dimensions or provenance', () => {
    assert.equal(normalizeAIStudioPrintReadiness(validReady, 'other-project', 'model-2').phase, 'invalid');
    assert.equal(normalizeAIStudioPrintReadiness({ ...validReady, measurementArtifactSha256: 'b'.repeat(64) }, 'project-1', 'model-2').phase, 'invalid');
    assert.equal(normalizeAIStudioPrintReadiness({ ...validReady, xMm: Infinity }, 'project-1', 'model-2').phase, 'invalid');
    assert.equal(normalizeAIStudioPrintReadiness({ ...validReady, provenanceId: '' }, 'project-1', 'model-2').phase, 'invalid');
    assert.equal(normalizeAIStudioPrintReadiness({ ...validReady, measurementModelVersionId: 'model-1' }, 'project-1', 'model-2').phase, 'invalid');
    assert.equal(normalizeAIStudioPrintReadiness({ ...validReady, modelStatus: 'READY_FOR_REVIEW' }, 'project-1', 'model-2').phase, 'invalid');
    assert.equal(normalizeAIStudioPrintReadiness({ ...validReady, projectStatus: 'MODEL_REVIEW' }, 'project-1', 'model-2').phase, 'invalid');
    assert.equal(normalizeAIStudioPrintReadiness({ ...validReady, dimensionMethod: 'private backend text' }, 'project-1', 'model-2').phase, 'invalid');
});

test('rejects NOT_READY responses carrying dimensions', () => {
    const result = normalizeAIStudioPrintReadiness({ ...validReady, printReadiness: 'NOT_READY', reasonCode: 'CONFLICT' }, 'project-1', 'model-2');
    assert.equal(result.phase, 'invalid');
    assert.equal(result.dimensionsMm, null);
});

test('identifies Design Project snapshots from IDs, evidence fields, or the private Project artifact route', () => {
    assert.equal(isDesignProjectPrintDraft({ projectId: 'project-1', modelVersionId: 'model-2' }), true);
    assert.equal(isDesignProjectPrintDraft({ printReadiness: 'READY', modelUrl: '/legacy.glb' }), true);
    assert.equal(isDesignProjectPrintDraft({ modelUrl: '/api/ai-studio/projects/project-1/models/model-2/artifact#design-model.glb' }), true);
    assert.equal(isDesignProjectPrintDraft({ modelUrl: '/api/ai-studio/projects/project-1/models/model-2/artifact?download=1' }), true);
    assert.equal(isDesignProjectPrintDraft({ measurementArtifactSha256: 'a'.repeat(64), modelUrl: '/legacy.glb' }), true);
    assert.equal(isDesignProjectPrintDraft({ id: 'generation-1', modelUrl: '/api/ai-studio/generations/1/result#model.glb', dimensions: '20 x 10 x 5 mm' }), false);
});

test('only accepts a route snapshot whose project, version, digest, dimensions and provenance match revalidated READY', () => {
    const readiness = normalizeAIStudioPrintReadiness(validReady, 'project-1', 'model-2');
    const draft = {
        projectId: 'project-1', modelVersionId: 'model-2', printReadiness: 'READY', artifactSha256: 'a'.repeat(64),
        dimensions: { x: 42.25, y: 28.5, z: 12.125 }, dimensionSource: 'trusted-measurement-service',
        dimensionMethod: 'mesh-bounds-v1', measurementModelVersionId: 'model-2',
        measurementArtifactSha256: 'a'.repeat(64), measuredAt: '2026-11-19T10:30:00Z', provenanceId: 'measurement-1',
    };
    assert.equal(matchesDesignProjectPrintDraft(draft, readiness), true);
    assert.equal(matchesDesignProjectPrintDraft({ ...draft, dimensions: { ...draft.dimensions, x: 999 } }, readiness), false);
    assert.equal(matchesDesignProjectPrintDraft({ ...draft, artifactSha256: 'b'.repeat(64) }, readiness), false);
    assert.equal(matchesDesignProjectPrintDraft({ ...draft, modelVersionId: 'model-3' }, readiness), false);
    assert.equal(matchesDesignProjectPrintDraft({ ...draft, provenanceId: 'altered' }, readiness), false);
});
