const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REASON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_.-]{0,63}$/;

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function isSafeMetadataValue(value) {
    return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value);
}

function invalidResult(reasonCode = null) {
    return { phase: 'invalid', readiness: null, reasonCode, dimensionsMm: null };
}

export function isDesignProjectPrintDraft(draft) {
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) return false;
    if (isNonEmptyString(draft.projectId) || isNonEmptyString(draft.modelVersionId)
        || draft.printReadiness === 'READY' || draft.printReadiness === 'NOT_READY'
        || isNonEmptyString(draft.artifactSha256) || isNonEmptyString(draft.measurementArtifactSha256)
        || isNonEmptyString(draft.dimensionSource) || isNonEmptyString(draft.dimensionMethod)
        || isNonEmptyString(draft.measuredAt) || isNonEmptyString(draft.provenanceId)
        || isNonEmptyString(draft.measurementModelVersionId)) return true;
    return typeof draft.modelUrl === 'string'
        && /\/ai-studio\/projects\/[^/]+\/models\/[^/]+\/artifact(?:[?#]|$)/.test(draft.modelUrl);
}

export function matchesDesignProjectPrintDraft(draft, readiness) {
    if (!draft || !readiness || readiness.phase !== 'ready' || readiness.readiness !== 'READY') return false;
    const dimensions = draft.dimensions;
    return draft.printReadiness === 'READY'
        && draft.projectId === readiness.projectId
        && draft.modelVersionId === readiness.modelVersionId
        && draft.artifactSha256 === readiness.artifactSha256
        && dimensions?.x === readiness.dimensionsMm?.x
        && dimensions?.y === readiness.dimensionsMm?.y
        && dimensions?.z === readiness.dimensionsMm?.z
        && draft.dimensionSource === readiness.dimensionSource
        && draft.dimensionMethod === readiness.dimensionMethod
        && draft.measurementModelVersionId === readiness.measurementModelVersionId
        && draft.measurementArtifactSha256 === readiness.measurementArtifactSha256
        && draft.measuredAt === readiness.measuredAt
        && draft.provenanceId === readiness.provenanceId;
}

export function normalizeAIStudioPrintReadiness(response, expectedProjectId, expectedModelVersionId) {
    if (!response || typeof response !== 'object' || Array.isArray(response)
        || response.projectId !== expectedProjectId
        || response.modelVersionId !== expectedModelVersionId
        || !isNonEmptyString(response.projectStatus)
        || !isNonEmptyString(response.modelStatus)
        || typeof response.artifactAvailable !== 'boolean'
        || !['READY', 'NOT_READY'].includes(response.printReadiness)
        || response.artifactSha256 !== null && (typeof response.artifactSha256 !== 'string' || !SHA256_PATTERN.test(response.artifactSha256))) {
        return invalidResult();
    }

    if (response.printReadiness === 'NOT_READY') {
        if (!isNonEmptyString(response.reasonCode) || !REASON_CODE_PATTERN.test(response.reasonCode)
            || ['xMm', 'yMm', 'zMm'].some((axis) => response[axis] !== null && response[axis] !== undefined)) {
            return invalidResult();
        }
        return {
            phase: 'not-ready',
            readiness: 'NOT_READY',
            reasonCode: response.reasonCode,
            dimensionsMm: null,
            projectId: response.projectId,
            modelVersionId: response.modelVersionId,
        };
    }

    const hasValidDimensions = ['xMm', 'yMm', 'zMm'].every((axis) => Number.isFinite(response[axis]) && response[axis] > 0);
    const measuredAt = typeof response.measuredAt === 'string' ? Date.parse(response.measuredAt) : NaN;
    if (response.reasonCode !== null
        || response.projectStatus !== 'COMPLETED'
        || response.modelStatus !== 'APPROVED'
        || response.artifactAvailable !== true
        || !SHA256_PATTERN.test(response.artifactSha256 || '')
        || !hasValidDimensions
        || response.dimensionUnit !== 'mm'
        || !isSafeMetadataValue(response.dimensionSource)
        || !isSafeMetadataValue(response.dimensionMethod)
        || response.measurementModelVersionId !== expectedModelVersionId
        || response.measurementArtifactSha256 !== response.artifactSha256
        || !Number.isFinite(measuredAt)
        || !isSafeMetadataValue(response.provenanceId)) {
        return invalidResult();
    }

    return {
        phase: 'ready',
        readiness: 'READY',
        reasonCode: null,
        projectId: response.projectId,
        modelVersionId: response.modelVersionId,
        artifactSha256: response.artifactSha256,
        dimensionsMm: { x: response.xMm, y: response.yMm, z: response.zMm },
        dimensionUnit: 'mm',
        dimensionSource: response.dimensionSource,
        dimensionMethod: response.dimensionMethod,
        measurementModelVersionId: response.measurementModelVersionId,
        measurementArtifactSha256: response.measurementArtifactSha256,
        measuredAt: response.measuredAt,
        provenanceId: response.provenanceId,
    };
}
