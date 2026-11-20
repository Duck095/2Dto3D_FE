import { lazy, Suspense, useState, useRef, useEffect, useLayoutEffect, useReducer, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { approveAIStudioProjectModel, approveAIStudioProjectReference, createAIGeneration, createAIStudioProject, generateAIStudioProjectModel, generateAIStudioProjectReferences, getAIGeneration, getAIGenerationHistory, getAIStudioProject, getAIStudioProjectHistory, getAIStudioProjectInputContent, getAIStudioProjectModelArtifact, getAIStudioProjectModelPrintReadiness, getAIStudioProjectPipeline, getAIStudioProjectReferenceView, getAIStudioProjectTimeline } from '../services/aiStudioService';
import { API_ROUTES } from '../config/apiRoutes.js';
import { getStudioInputMode } from '../features/ai-studio/inputMode';
import { createGenerationResultsState, createPrintDraftFromGeneration, generationResultsReducer, generationSubmissionReducer, getGenerationOwnerKey, getGenerationResultsForOwner, initialGenerationSubmissionState, resolveGenerationResponse } from '../features/ai-studio/generationPresentation';
import { buildImageDesignProjectRequest, buildMultiDesignProjectRequest, buildTextDesignProjectRequest, claimDesignProjectSave, classifyDesignProjectIdempotencyRecord, classifyDesignProjectRequestError, createDesignProjectIdempotencyRecord, createMultiDesignProjectIdempotencyRecord, getCreatedDesignProjectId, getDesignProjectRequestFingerprint, getDesignProjectStateForOwner, getImageContentSha256, getMultiDesignProjectRequestFingerprint, hasMatchingProjectInputBlob, parseDesignProjectIdempotencyRecord, releaseDesignProjectSave, resolveDesignProject } from '../features/ai-studio/projectPresentation.js';
import { classifyPipelineReadError, getPipelineJobFailureMessage, getPipelineStatusLabel, getProjectPipelineStateForOwner, hasActivePipelineJobs, MAX_AUTOMATIC_PIPELINE_READS, normalizeProjectPipeline, PIPELINE_POLL_INTERVAL_MS, shouldContinuePipelinePolling } from '../features/ai-studio/pipelinePresentation.js';
import { classifyProjectHistoryError, getProjectHistoryStateForOwner, mergeDesignProjectHistoryPages, normalizeDesignProjectHistoryPage, PROJECT_HISTORY_PAGE_SIZE } from '../features/ai-studio/projectHistoryPresentation.js';
import { getOrCreateDesignCommandKey, markDesignCommandKeyOutcome } from '../features/ai-studio/designCommandIdempotency.js';
import { getDesignReferenceViewMetadata, hasCompleteReferenceViewSlots, normalizeProjectTimeline, validateDesignModelArtifactBlob, validateDesignReferenceImageBlob } from '../features/ai-studio/projectWorkflowPresentation.js';
import { normalizeAIStudioPrintReadiness } from '../features/ai-studio/printReadinessPresentation.js';
import { validateStudioImage } from '../features/ai-studio/uploadValidation';
import { getStudioApiInputMode, initialViewerCustomizationState, viewerCustomizationReducer, viewerCustomizationToPrintDraftOptions } from '../features/ai-studio/studioPresentation.js';
import AIStudioWorkspace from './AIStudioWorkspace.jsx';
import './ai-studio.css';

const ThreeDViewer = lazy(() => import('../components/ThreeDViewer'));
const BACKEND_PROJECT_STATUSES = new Set([
    'DRAFT', 'REFERENCES_QUEUED', 'REFERENCES_GENERATING', 'REFERENCES_REVIEW',
    'REFERENCES_APPROVED', 'MODEL_QUEUED', 'MODEL_GENERATING', 'MODEL_REVIEW', 'COMPLETED', 'FAILED',
]);

function isBackendUuid(value) {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getWorkflowCommandErrorMessage(error) {
    const status = error?.response?.status;
    if (status === 401) return 'Phiên đăng nhập cần được xác thực lại trước khi thao tác.';
    if (status === 403) return 'Tài khoản hiện không có quyền thực hiện thao tác này.';
    if (status === 404) return 'Project hoặc phiên bản không còn khả dụng.';
    if (status === 409) return 'Pipeline đã thay đổi hoặc phiên bản đã cũ. Đã đọc lại trạng thái Backend; hãy chọn phiên bản hiện tại trước khi thử lại.';
    if (status === 422) return 'Backend từ chối dữ liệu thao tác. Kiểm tra lại nội dung và trạng thái phiên bản.';
    if (status === 429) return 'Backend đang giới hạn lượt sử dụng. Lệnh chưa được xác nhận; hãy thử lại cùng thao tác sau.';
    if (status >= 500) return 'Backend chưa xác nhận kết quả thao tác. Giữ nguyên nội dung và thử lại để dùng lại cùng Idempotency-Key.';
    if (status) return 'Backend từ chối thao tác. Trạng thái thực tế đã được đọc lại.';
    return 'Mất kết nối trước khi xác nhận thao tác. Thử lại cùng nội dung để dùng lại cùng Idempotency-Key.';
}

function getPrintReadinessErrorMessage(error) {
    const status = error?.response?.status;
    if (status === 401) return 'Phiên đăng nhập cần được xác thực lại trước khi kiểm tra điều kiện chuẩn bị in.';
    if (status === 403) return 'Tài khoản hiện không có quyền đọc điều kiện chuẩn bị in.';
    if (status === 404) return 'Project hoặc model version không còn khả dụng để kiểm tra.';
    return 'Chưa đọc được điều kiện chuẩn bị in từ Backend. Bạn có thể thử lại.';
}

const POLL_DELAYS_MS = [500, 800, 1200, 1800, 2500, 3500, 5000];

function createIdempotencyKey() {
    return globalThis.crypto?.randomUUID?.()
        || `studio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getProjectErrorMessage(error, operation) {
    const classification = classifyDesignProjectRequestError(error);
    if (classification.code === 'unauthenticated') return 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại rồi thử tiếp.';
    if (classification.code === 'forbidden') return 'Tài khoản hiện tại không có quyền truy cập dự án này.';
    if (classification.outcome === 'indeterminate') {
        return operation === 'save'
            ? 'Chưa xác định được Backend đã lưu dự án hay chưa. Có thể gửi lại an toàn bằng cùng khóa idempotency.'
            : 'Chưa tải được dự án từ Backend. Vui lòng thử đọc lại.';
    }
    const backendMessage = error?.response?.data?.message;
    if (typeof backendMessage === 'string' && backendMessage.trim()) return backendMessage;
    return operation === 'save'
        ? 'Backend đã từ chối lưu dự án. Kiểm tra lựa chọn rồi thử lại.'
        : 'Backend không trả về dự án hợp lệ.';
}

function getErrorMessage(error) {
    const response = error?.response?.data;
    if (typeof response?.message === 'string' && response.message.trim()) return response.message;
    if (response?.code === 'FEATURE_DISABLED') return 'AI Studio chưa được bật cho môi trường này.';
    if (response?.code === 'AI_PROVIDER_NOT_CONFIGURED') return 'Backend chưa được cấu hình nhà cung cấp AI.';
    if (error?.response?.status === 401) return 'Vui lòng đăng nhập để tạo và xem mô hình của bạn.';
    return error instanceof Error && error.message
        ? error.message
        : 'Không thể kết nối với dịch vụ tạo mô hình. Vui lòng thử lại.';
}

function waitForPoll(delayMs, signal) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) {
            reject(new DOMException('Request aborted', 'AbortError'));
            return;
        }
        const timer = window.setTimeout(resolve, delayMs);
        signal.addEventListener('abort', () => {
            window.clearTimeout(timer);
            reject(new DOMException('Request aborted', 'AbortError'));
        }, { once: true });
    });
}

function getProjectInputExtension(mimeType) {
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/jpeg') return 'jpg';
    if (mimeType === 'image/webp') return 'webp';
    return null;
}

async function restoreProjectInputFile(projectId, input, signal) {
    const extension = getProjectInputExtension(input.mimeType);
    if (!extension) throw new Error('Unsupported project input type.');
    const content = await getAIStudioProjectInputContent(projectId, input.inputId, { signal });
    if (!hasMatchingProjectInputBlob(content, input)) throw new Error('Project input content did not match its metadata.');
    const file = new File([content], `project-${input.order + 1}.${extension}`, { type: input.mimeType });
    const sha256 = await getImageContentSha256(file);
    if (sha256 !== input.sha256) throw new Error('Project input content failed integrity validation.');
    return { file, sha256 };
}

function readStoredProjectRequest(accountKey, memoryRecords) {
    if (!accountKey) return { classification: 'none', record: null };
    if (memoryRecords.has(accountKey)) {
        const record = memoryRecords.get(accountKey);
        return { classification: classifyDesignProjectIdempotencyRecord(record), record };
    }
    try {
        return parseDesignProjectIdempotencyRecord(window.sessionStorage.getItem(`2dto3d.ai-studio.project-idempotency:${accountKey}`));
    } catch {
        return { classification: 'unknown', record: null };
    }
}

function getProjectReconciliationMessage(classification) {
    if (classification === 'legacy-multi-v2') {
        return 'Lượt lưu MULTI cũ có thể còn lưu ý tưởng thô trong sessionStorage. Hãy đối chiếu thủ công; dữ liệu chưa được tự xóa.';
    }
    if (classification === 'legacy-fnv') {
        return 'Lượt lưu cũ dùng fingerprint 32-bit nên chưa thể xác minh an toàn. Cần đối chiếu thủ công trước khi thử lại MULTI.';
    }
    return 'Không thể xác minh bản ghi idempotency đã lưu. Yêu cầu chưa được gửi; cần đối chiếu thủ công trước khi tiếp tục.';
}

/* ═══════════════════════════════════════════════════════════
   AI STUDIO PAGE
   ═══════════════════════════════════════════════════════════ */
export default function AIStudioPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, sessionVersion, isLoading: authLoading } = useAuth();
    const persistedGenerationOwnerKey = getGenerationOwnerKey(user);
    const generationOwnerKey = persistedGenerationOwnerKey ?? (user ? `session-${sessionVersion}` : 'anonymous');
    const generationSessionKey = `${generationOwnerKey}:session-${sessionVersion}`;
    const editDraft = location.state?.modelEditDraft;
    const [inputMode, setInputMode] = useState(() => getStudioInputMode(location.search, editDraft));
    const [style, setStyle] = useState('Realistic');
    const [productType, setProductType] = useState(null);
    const [keychainVariant, setKeychainVariant] = useState('ordinary');
    const [textPrompt, setTextPrompt] = useState(editDraft?.prompt || '');
    const [generationSubmission, dispatchGeneration] = useReducer(generationSubmissionReducer, initialGenerationSubmissionState);
    const [generationResults, dispatchGenerationResults] = useReducer(
        generationResultsReducer,
        generationSessionKey,
        createGenerationResultsState,
    );
    const { isGenerated, selectedGeneration, history: sessionHistory } = getGenerationResultsForOwner(generationResults, generationSessionKey);
    const [viewerCustomization, dispatchViewerCustomization] = useReducer(viewerCustomizationReducer, initialViewerCustomizationState);
    const { partColors, modelColor, modelScale } = viewerCustomization;
    const [uploadedImg, setUploadedImg] = useState(editDraft?.imageDataUrl || null);
    const [uploadedFile, setUploadedFileState] = useState(null);
    const [imageContentSha256, setImageContentSha256] = useState(null);
    const [isPreparingImage, setIsPreparingImage] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [multiViews, setMultiViews] = useState({});
    const [extraViewSlots, setExtraViewSlots] = useState([]);
    const [multiUploadError, setMultiUploadError] = useState('');
    const [pendingMultiHashes, setPendingMultiHashes] = useState(0);

    useEffect(() => {
        const nextInputMode = getStudioInputMode(location.search, editDraft);
        if (nextInputMode !== inputMode) updateProjectInput(setInputMode, nextInputMode);
    }, [location.search, editDraft]);
    const [showPrintNameDialog, setShowPrintNameDialog] = useState(false);
    const [printProductName, setPrintProductName] = useState('');
    const [printDraftError, setPrintDraftError] = useState('');
    const [pendingOwnerReadyKey, setPendingOwnerReadyKey] = useState(undefined);
    const [activeJobId, setActiveJobId] = useState(null);
    const uploadedObjectUrlRef = useRef(null);
    const multiViewsRef = useRef({});
    const multiObjectUrlsRef = useRef(new Set());
    const multiHashTasksRef = useRef(new Map());
    const multiHashTaskIdRef = useRef(0);
    const uploadFingerprintTaskRef = useRef(0);
    const localProjectIdRef = useRef(null);
    const localProjectImageSha256Ref = useRef(null);
    const localProjectMultiFingerprintRef = useRef(null);
    const [generationMessageOwnerKey, setGenerationMessageOwnerKey] = useState(generationSessionKey);
    const [genError, setGenError] = useState('');
    const [genStatus, setGenStatus] = useState('');
    const generationInFlightOwnersRef = useRef(new Set());
    const generationRequestRef = useRef(null);
    const projectCreateRequestRef = useRef(null);
    const projectReadRequestRef = useRef(null);
    const pipelineReadRequestRef = useRef(null);
    const pipelineGenerationRef = useRef(0);
    const projectInFlightOwnersRef = useRef(new Set());
    const projectIdempotencyKeysRef = useRef(new Map());
    const projectInputRevisionRef = useRef(0);
    const [projectInputRevision, setProjectInputRevision] = useState(0);
    const [preparedMultiIdentity, setPreparedMultiIdentity] = useState(null);
    const projectOwnerKeyRef = useRef(generationSessionKey);
    const previousProjectOwnerKeyRef = useRef(persistedGenerationOwnerKey);
    projectOwnerKeyRef.current = generationSessionKey;
    const [projectSavingOwnerKey, setProjectSavingOwnerKey] = useState(null);
    const [projectReadRevision, setProjectReadRevision] = useState(0);
    const [projectState, setProjectState] = useState({ ownerKey: null, phase: 'idle', projectId: '', project: null, message: '' });
    const [projectHistoryState, setProjectHistoryState] = useState({ ownerKey: null, phase: 'idle', items: [], page: -1, size: PROJECT_HISTORY_PAGE_SIZE, totalElements: 0, totalPages: 0, last: true, loadingMore: false, message: '', pageError: '' });
    const [projectHistoryReloadRevision, setProjectHistoryReloadRevision] = useState(0);
    const projectHistoryStateRef = useRef(projectHistoryState);
    const projectHistoryOwnerKeyRef = useRef(generationSessionKey);
    const projectHistoryInitialRequestRef = useRef(null);
    const projectHistoryPageRequestRef = useRef(null);
    const projectHistoryPageInFlightRef = useRef(null);
    projectHistoryStateRef.current = projectHistoryState;
    projectHistoryOwnerKeyRef.current = generationSessionKey;
    const visibleProjectHistoryState = getProjectHistoryStateForOwner(projectHistoryState, generationSessionKey);
    const projectIdFromUrl = new URLSearchParams(location.search).get('projectId')?.trim() || '';
    const projectIdFromUrlRef = useRef(projectIdFromUrl);
    projectIdFromUrlRef.current = projectIdFromUrl;
    const [pipelineReadRevision, setPipelineReadRevision] = useState(0);
    const [pipelineState, setPipelineState] = useState({ ownerKey: null, projectId: '', phase: 'idle', pipeline: null, message: '', automaticReadCount: 0, pollingStopped: null });
    const [selectedReferenceVersionId, setSelectedReferenceVersionId] = useState('');
    const [selectedModelVersionId, setSelectedModelVersionId] = useState('');
    const [referenceViewState, setReferenceViewState] = useState({ ownerKey: null, projectId: '', versionId: '', phase: 'idle', items: [], message: '' });
    const [modelArtifactState, setModelArtifactState] = useState({ ownerKey: null, projectId: '', modelVersionId: '', phase: 'idle', url: '', viewerUrl: '', message: '' });
    const modelArtifactStateRef = useRef(modelArtifactState);
    modelArtifactStateRef.current = modelArtifactState;
    const [timelineState, setTimelineState] = useState({ ownerKey: null, projectId: '', phase: 'idle', timeline: null, message: '' });
    const [timelineReadRevision, setTimelineReadRevision] = useState(0);
    const [printReadinessState, setPrintReadinessState] = useState({ ownerKey: null, projectId: '', modelVersionId: '', phase: 'idle', data: null, message: '' });
    const [printReadinessReadRevision, setPrintReadinessReadRevision] = useState(0);
    const [workflowCommandState, setWorkflowCommandState] = useState({ ownerKey: null, projectId: '', phase: 'idle', operation: '', message: '' });
    const workflowMutationRequestRef = useRef(null);
    const workflowMutationInFlightRef = useRef(false);
    const selectedReferenceVersionIdRef = useRef(selectedReferenceVersionId);
    const selectedModelVersionIdRef = useRef(selectedModelVersionId);
    const isSavingProject = projectSavingOwnerKey === generationSessionKey;
    const visibleProjectState = getDesignProjectStateForOwner(projectState, generationSessionKey);
    const visibleProject = visibleProjectState.project;
    const isProjectAuthenticated = Boolean(user && persistedGenerationOwnerKey && !authLoading);
    const confirmedProjectId = isProjectAuthenticated
        && visibleProjectState.phase === 'loaded'
        && visibleProject?.projectId === projectIdFromUrl
        ? visibleProject.projectId
        : '';
    const visiblePipelineState = getProjectPipelineStateForOwner(pipelineState, generationSessionKey, confirmedProjectId);
    const visiblePipeline = visiblePipelineState.pipeline;
    const referenceVersions = visiblePipeline?.referenceVersions || [];
    const modelVersions = visiblePipeline?.modelVersions || [];
    const latestReferenceVersion = referenceVersions.at(-1) || null;
    const latestModelVersion = modelVersions.at(-1) || null;
    const selectedReferenceVersion = referenceVersions.find((version) => version.versionId === selectedReferenceVersionId)
        || (!selectedReferenceVersionId ? latestReferenceVersion : null);
    const selectedModelVersion = modelVersions.find((version) => version.modelVersionId === selectedModelVersionId)
        || (!selectedModelVersionId ? latestModelVersion : null);
    selectedReferenceVersionIdRef.current = selectedReferenceVersion?.versionId || '';
    selectedModelVersionIdRef.current = selectedModelVersion?.modelVersionId || '';
    const visibleReferenceViewState = referenceViewState.ownerKey === generationSessionKey
        && referenceViewState.projectId === confirmedProjectId
        && referenceViewState.versionId === selectedReferenceVersion?.versionId
        ? referenceViewState
        : { ownerKey: generationSessionKey, projectId: confirmedProjectId, versionId: selectedReferenceVersion?.versionId || '', phase: 'idle', items: [], message: '' };
    const visibleModelArtifactState = modelArtifactState.ownerKey === generationSessionKey
        && modelArtifactState.projectId === confirmedProjectId
        && modelArtifactState.modelVersionId === selectedModelVersion?.modelVersionId
        ? modelArtifactState
        : { ownerKey: generationSessionKey, projectId: confirmedProjectId, modelVersionId: selectedModelVersion?.modelVersionId || '', phase: 'idle', url: '', viewerUrl: '', sha256: '', message: '' };
    const visiblePrintReadinessState = printReadinessState.ownerKey === generationSessionKey
        && printReadinessState.projectId === confirmedProjectId
        && printReadinessState.modelVersionId === selectedModelVersion?.modelVersionId
        ? printReadinessState
        : { ownerKey: generationSessionKey, projectId: confirmedProjectId, modelVersionId: selectedModelVersion?.modelVersionId || '', phase: 'idle', data: null, message: '' };
    const visibleTimelineState = timelineState.ownerKey === generationSessionKey && timelineState.projectId === confirmedProjectId
        ? timelineState
        : { ownerKey: generationSessionKey, projectId: confirmedProjectId, phase: 'idle', timeline: null, message: '' };
    const visibleWorkflowCommandState = workflowCommandState.ownerKey === generationSessionKey && workflowCommandState.projectId === confirmedProjectId
        ? workflowCommandState
        : { ownerKey: generationSessionKey, projectId: confirmedProjectId, phase: 'idle', operation: '', message: '' };
    useLayoutEffect(() => {
        const pending = workflowMutationRequestRef.current;
        if (pending && (pending.projectId !== projectIdFromUrl || pending.ownerKey !== generationSessionKey)) {
            pending.controller.abort();
            workflowMutationRequestRef.current = null;
            workflowMutationInFlightRef.current = false;
        }
        setSelectedReferenceVersionId('');
        setSelectedModelVersionId('');
        setWorkflowCommandState({ ownerKey: generationSessionKey, projectId: '', phase: 'idle', operation: '', message: '' });
    }, [generationSessionKey, projectIdFromUrl]);
    const currentProjectRequest = inputMode === 'text'
        ? buildTextDesignProjectRequest({ productType, keychainVariant, styleId: style, originalIdea: textPrompt })
        : inputMode === 'image'
            ? buildImageDesignProjectRequest({ productType, keychainVariant, styleId: style, originalIdea: textPrompt })
            : inputMode === 'multi'
                ? buildMultiDesignProjectRequest({
                    productType, keychainVariant, styleId: style, originalIdea: textPrompt,
                    uploads: Object.entries(multiViews).map(([slotId, upload]) => ({ slotId, ...upload })),
                })
                : { error: 'mode', data: null };
    const currentMultiContentFingerprint = inputMode === 'multi' && currentProjectRequest.data
        && currentProjectRequest.uploads?.every((upload) => typeof upload.sha256 === 'string' && upload.sha256)
        ? JSON.stringify(currentProjectRequest.uploads.map(({ slotId, sha256 }) => ({ slotId, sha256 })))
        : null;
    const currentMultiRequestDataKey = inputMode === 'multi' && currentProjectRequest.data
        ? JSON.stringify(currentProjectRequest.data)
        : '';
    const currentProjectContentFingerprint = inputMode === 'image'
        ? imageContentSha256
        : inputMode === 'multi' ? currentMultiContentFingerprint : null;
    const storedProjectRequestState = readStoredProjectRequest(persistedGenerationOwnerKey, projectIdempotencyKeysRef.current);
    const multiIdentityMatchesRequest = inputMode === 'multi'
        && preparedMultiIdentity?.ownerKey === generationSessionKey
        && preparedMultiIdentity.revision === projectInputRevisionRef.current
        && preparedMultiIdentity.fingerprint === visibleProjectState.requestFingerprint;
    const matchesUnresolvedProjectRequest = Boolean(currentProjectRequest.data
        && (inputMode !== 'image' || (uploadedFile && imageContentSha256))
        && (inputMode !== 'multi' || currentMultiContentFingerprint)
        && visibleProjectState.requestFingerprint
        && (inputMode === 'multi'
            ? multiIdentityMatchesRequest
            : getDesignProjectRequestFingerprint(currentProjectRequest.data, currentProjectContentFingerprint) === visibleProjectState.requestFingerprint));
    const canRetryProject = visibleProjectState.phase === 'indeterminate' && matchesUnresolvedProjectRequest;
    const requiresManualProjectReconciliation = storedProjectRequestState.classification === 'unknown'
        || (inputMode === 'multi' && ['legacy-fnv', 'legacy-multi-v2'].includes(storedProjectRequestState.classification));
    const canSaveProject = isProjectAuthenticated
        && !requiresManualProjectReconciliation
        && (visibleProjectState.phase !== 'indeterminate' || matchesUnresolvedProjectRequest);
    const projectReconciliationMessage = getProjectReconciliationMessage(storedProjectRequestState.classification);
    const idempotencyKeysRef = useRef(new Map());
    const generationOwnerKeyRef = useRef(generationSessionKey);
    generationOwnerKeyRef.current = generationSessionKey;

    useEffect(() => {
        if (inputMode !== 'multi' || !currentProjectRequest.data || !currentMultiContentFingerprint) {
            setPreparedMultiIdentity(null);
            return undefined;
        }
        const ownerKey = generationSessionKey;
        const revision = projectInputRevisionRef.current;
        let active = true;
        const imageHashes = currentProjectRequest.uploads.map(({ slotId, sha256 }) => ({ slotId, sha256 }));
        getMultiDesignProjectRequestFingerprint(currentProjectRequest.data, imageHashes).then((fingerprint) => {
            if (!active || projectInputRevisionRef.current !== revision || projectOwnerKeyRef.current !== ownerKey) return;
            setPreparedMultiIdentity({ ownerKey, revision, fingerprint });
        }).catch(() => {
            if (!active || projectInputRevisionRef.current !== revision || projectOwnerKeyRef.current !== ownerKey) return;
            setPreparedMultiIdentity(null);
        });
        return () => { active = false; };
    }, [inputMode, currentMultiContentFingerprint, currentMultiRequestDataKey, generationSessionKey, projectInputRevision]);

    const visibleGenError = generationMessageOwnerKey === generationSessionKey ? genError : '';
    const visibleGenStatus = generationMessageOwnerKey === generationSessionKey ? genStatus : '';
    const pendingOwnerReady = !authLoading
        && pendingOwnerReadyKey !== undefined
        && pendingOwnerReadyKey === generationSessionKey;
    const isGenerating = pendingOwnerReady && generationSubmission.status === 'submitting';
    const isGenerationPending = pendingOwnerReady && Boolean(activeJobId)
        && generationSubmission.status === 'pending';

    useEffect(() => {
        if (authLoading) {
            setPendingOwnerReadyKey(undefined);
            return;
        }
        generationRequestRef.current?.abort();
        generationRequestRef.current = null;
        setActiveJobId(null);
        dispatchGeneration({ type: 'restore', state: initialGenerationSubmissionState });
        dispatchGenerationResults({ type: 'reset-owner', ownerKey: generationSessionKey });
        setGenerationMessageOwnerKey(generationSessionKey);
        setGenError('');
        setShowPrintNameDialog(false);
        setPrintProductName('');
        setPrintDraftError('');
        setGenStatus('');
        setPendingOwnerReadyKey(generationSessionKey);

        if (!user || !persistedGenerationOwnerKey) return () => { };
        const controller = new AbortController();
        getAIGenerationHistory(0, 50, { signal: controller.signal }).then(response => {
            if (generationOwnerKeyRef.current !== generationSessionKey) return;
            const rows = Array.isArray(response?.content) ? response.content : Array.isArray(response) ? response : [];
            dispatchGenerationResults({ type: 'history-loaded', ownerKey: generationSessionKey, history: rows });
            const pending = rows.find(item => ['PENDING', 'PROCESSING'].includes(String(item?.status || '').toUpperCase()));
            if (pending?.id) {
                setActiveJobId(pending.id);
                dispatchGeneration({ type: 'pending' });
                setGenStatus('Đang có yêu cầu tạo mô hình trên máy chủ. Chọn “Theo dõi mô hình” để cập nhật trạng thái.');
            }
        }).catch(() => {
            if (controller.signal.aborted || generationOwnerKeyRef.current !== generationSessionKey) return;
            setGenStatus('Chưa tải được lịch sử tạo mô hình. Có thể thử lại bằng cách mở lại trang.');
        });
        return () => controller.abort();
    }, [authLoading, generationOwnerKey, generationSessionKey, persistedGenerationOwnerKey]);

    useEffect(() => {
        projectHistoryInitialRequestRef.current?.abort();
        projectHistoryPageRequestRef.current?.abort();
        projectHistoryPageRequestRef.current = null;
        projectHistoryPageInFlightRef.current = null;
        const requestOwnerKey = generationSessionKey;

        if (authLoading) {
            setProjectHistoryState({ ownerKey: requestOwnerKey, phase: 'idle', items: [], page: -1, size: PROJECT_HISTORY_PAGE_SIZE, totalElements: 0, totalPages: 0, last: true, loadingMore: false, message: '', pageError: '' });
            return undefined;
        }
        if (!user || !persistedGenerationOwnerKey) {
            setProjectHistoryState({ ownerKey: requestOwnerKey, phase: 'auth-required', items: [], page: -1, size: PROJECT_HISTORY_PAGE_SIZE, totalElements: 0, totalPages: 0, last: true, loadingMore: false, message: 'Đăng nhập để xem các dự án đã lưu.', pageError: '' });
            return undefined;
        }

        const previous = projectHistoryStateRef.current;
        const retainedItems = previous.ownerKey === requestOwnerKey ? previous.items : [];
        const controller = new AbortController();
        projectHistoryInitialRequestRef.current = controller;
        setProjectHistoryState({
            ownerKey: requestOwnerKey,
            phase: retainedItems.length ? 'refreshing' : 'loading',
            items: retainedItems,
            page: previous.ownerKey === requestOwnerKey ? previous.page : -1,
            size: PROJECT_HISTORY_PAGE_SIZE,
            totalElements: previous.ownerKey === requestOwnerKey ? previous.totalElements : 0,
            totalPages: previous.ownerKey === requestOwnerKey ? previous.totalPages : 0,
            last: previous.ownerKey === requestOwnerKey ? previous.last : true,
            loadingMore: false,
            message: '',
            pageError: '',
        });

        getAIStudioProjectHistory(0, PROJECT_HISTORY_PAGE_SIZE, { signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || projectHistoryOwnerKeyRef.current !== requestOwnerKey) return;
            const page = normalizeDesignProjectHistoryPage(response, 0, PROJECT_HISTORY_PAGE_SIZE);
            if (!page) {
                setProjectHistoryState((current) => current.ownerKey === requestOwnerKey ? {
                    ...current,
                    phase: 'invalid',
                    message: 'Backend trả về danh sách dự án chưa hợp lệ.',
                } : current);
                return;
            }
            setProjectHistoryState({
                ownerKey: requestOwnerKey,
                phase: 'ready',
                items: page.content,
                page: page.page,
                size: page.size,
                totalElements: page.totalElements,
                totalPages: page.totalPages,
                last: page.last,
                loadingMore: false,
                message: '',
                pageError: '',
            });
        }).catch((error) => {
            if (controller.signal.aborted || projectHistoryOwnerKeyRef.current !== requestOwnerKey) return;
            const classification = classifyProjectHistoryError(error);
            setProjectHistoryState((current) => current.ownerKey === requestOwnerKey ? {
                ...current,
                phase: 'error',
                message: classification.message,
            } : current);
        });

        return () => {
            controller.abort();
            projectHistoryPageRequestRef.current?.abort();
            if (projectHistoryInitialRequestRef.current === controller) projectHistoryInitialRequestRef.current = null;
        };
    }, [authLoading, generationSessionKey, persistedGenerationOwnerKey, projectHistoryReloadRevision, user]);

    useLayoutEffect(() => {
        const accountChanged = previousProjectOwnerKeyRef.current !== persistedGenerationOwnerKey;
        previousProjectOwnerKeyRef.current = persistedGenerationOwnerKey;
        invalidateProjectInput();
        projectCreateRequestRef.current?.abort();
        projectReadRequestRef.current?.abort();
        pipelineReadRequestRef.current?.abort();
        workflowMutationRequestRef.current?.controller.abort();
        workflowMutationRequestRef.current = null;
        workflowMutationInFlightRef.current = false;
        pipelineReadRequestRef.current = null;
        pipelineGenerationRef.current += 1;
        projectCreateRequestRef.current = null;
        projectReadRequestRef.current = null;
        projectInFlightOwnersRef.current.clear();
        setProjectSavingOwnerKey(null);
        setProjectState({ ownerKey: generationSessionKey, phase: 'idle', projectId: '', project: null, message: '' });
        setPipelineState({ ownerKey: generationSessionKey, projectId: '', phase: 'idle', pipeline: null, message: '', automaticReadCount: 0, pollingStopped: null });
        setSelectedReferenceVersionId('');
        setSelectedModelVersionId('');
        setReferenceViewState({ ownerKey: generationSessionKey, projectId: '', versionId: '', phase: 'idle', items: [], message: '' });
        setModelArtifactState({ ownerKey: generationSessionKey, projectId: '', modelVersionId: '', phase: 'idle', url: '', viewerUrl: '', message: '' });
        setTimelineState({ ownerKey: generationSessionKey, projectId: '', phase: 'idle', timeline: null, message: '' });
        setWorkflowCommandState({ ownerKey: generationSessionKey, projectId: '', phase: 'idle', operation: '', message: '' });
        if (accountChanged) {
            setProductType(null);
            setKeychainVariant('ordinary');
            setStyle('Realistic');
            setTextPrompt('');
            clearUploadedFile();
            clearMultiViews();
            localProjectIdRef.current = null;
            localProjectImageSha256Ref.current = null;
            localProjectMultiFingerprintRef.current = null;
        }
    }, [generationSessionKey, persistedGenerationOwnerKey]);

    useEffect(() => {
        if (authLoading) return undefined;
        const requestSessionKey = generationSessionKey;
        if (!projectIdFromUrl) {
            pipelineReadRequestRef.current?.abort();
            pipelineGenerationRef.current += 1;
            setPipelineState({ ownerKey: requestSessionKey, projectId: '', phase: 'idle', pipeline: null, message: '', automaticReadCount: 0, pollingStopped: null });
            const savedState = user && persistedGenerationOwnerKey
                ? readStoredProjectRequest(persistedGenerationOwnerKey, projectIdempotencyKeysRef.current)
                : { classification: 'none', record: null };
            const hasUnresolvedSave = savedState.classification !== 'none';
            const visibleSavedFingerprint = ['legacy-fnv', 'multi-v3'].includes(savedState.classification)
                ? savedState.record?.fingerprint
                : null;
            setProjectState({
                ownerKey: requestSessionKey,
                phase: hasUnresolvedSave ? 'indeterminate' : 'idle',
                projectId: '',
                project: null,
                requestFingerprint: visibleSavedFingerprint || null,
                message: hasUnresolvedSave
                    ? savedState.classification === 'legacy-fnv' || savedState.classification === 'legacy-multi-v2' || savedState.classification === 'unknown'
                        ? getProjectReconciliationMessage(savedState.classification)
                        : 'Có lượt lưu dự án chưa được xác nhận. Hãy khôi phục đúng dữ liệu trước khi gửi lại bằng cùng khóa idempotency.'
                    : '',
            });
            return undefined;
        }
        if (!user || !persistedGenerationOwnerKey) {
            pipelineReadRequestRef.current?.abort();
            pipelineGenerationRef.current += 1;
            setPipelineState({ ownerKey: requestSessionKey, projectId: '', phase: 'idle', pipeline: null, message: '', automaticReadCount: 0, pollingStopped: null });
            setProjectState({
                ownerKey: requestSessionKey,
                phase: 'auth-required',
                projectId: projectIdFromUrl,
                project: null,
                message: 'Vui lòng đăng nhập để đọc dự án từ Backend.',
            });
            return undefined;
        }

        const controller = new AbortController();
        projectReadRequestRef.current?.abort();
        pipelineReadRequestRef.current?.abort();
        pipelineGenerationRef.current += 1;
        setPipelineState({ ownerKey: requestSessionKey, projectId: '', phase: 'idle', pipeline: null, message: '', automaticReadCount: 0, pollingStopped: null });
        projectReadRequestRef.current = controller;
        setProjectState({ ownerKey: requestSessionKey, phase: 'loading', projectId: projectIdFromUrl, project: null, message: 'Đang đọc dự án từ Backend…' });

        getAIStudioProject(projectIdFromUrl, { signal: controller.signal }).then(async (response) => {
            if (controller.signal.aborted || projectOwnerKeyRef.current !== requestSessionKey) return;
            const project = resolveDesignProject(response, projectIdFromUrl);
            if (!project) {
                setProjectState({ ownerKey: requestSessionKey, phase: 'error', projectId: projectIdFromUrl, project: null, message: 'Backend chưa trả về đủ thông tin hợp lệ của dự án.' });
                return;
            }
            invalidateProjectInput();
            setProductType(project.productType);
            setKeychainVariant(project.keychainVariant || 'ordinary');
            setStyle(project.styleId);
            setTextPrompt(project.originalIdea || '');
            setInputMode(project.inputMode);
            clearUploadedFile();
            clearMultiViews();
            let sourceImageAvailable = false;
            let sourceMultiFilesAvailable = false;
            let sourceRestoreMessage = '';
            const restoredUrls = [];
            try {
                if (project.inputMode === 'image' && project.inputs.length === 1) {
                    const input = project.inputs[0];
                    const restored = await restoreProjectInputFile(project.projectId, input, controller.signal);
                    if (controller.signal.aborted || projectOwnerKeyRef.current !== requestSessionKey) return;
                    const url = URL.createObjectURL(restored.file);
                    restoredUrls.push(url);
                    uploadedObjectUrlRef.current = url;
                    setUploadedImg(url);
                    setUploadedFileState(restored.file);
                    setImageContentSha256(restored.sha256);
                    localProjectIdRef.current = project.projectId;
                    localProjectImageSha256Ref.current = restored.sha256;
                    sourceImageAvailable = true;
                } else if (project.inputMode === 'multi' && project.inputs.length >= 2) {
                    const restoredInputs = await Promise.all(project.inputs.map(async (input) => ({
                        input,
                        restored: await restoreProjectInputFile(project.projectId, input, controller.signal),
                    })));
                    if (controller.signal.aborted || projectOwnerKeyRef.current !== requestSessionKey) return;
                    const restoredViews = {};
                    for (const { input, restored } of restoredInputs) {
                        if (!input.clientSlot || restoredViews[input.clientSlot]) throw new Error('Project input slots are invalid.');
                        const url = URL.createObjectURL(restored.file);
                        restoredUrls.push(url);
                        multiObjectUrlsRef.current.add(url);
                        restoredViews[input.clientSlot] = { file: restored.file, url, sha256: restored.sha256 };
                    }
                    multiViewsRef.current = restoredViews;
                    setMultiViews(restoredViews);
                    setExtraViewSlots(project.clientSlots.filter((slot) => slot.startsWith('extra-')).map((id, index) => ({ id, label: `Góc bổ sung ${index + 1}` })));
                    localProjectIdRef.current = project.projectId;
                    localProjectMultiFingerprintRef.current = JSON.stringify(project.inputs.map((input) => ({ slotId: input.clientSlot, sha256: input.sha256 })));
                    sourceMultiFilesAvailable = true;
                }
            } catch {
                if (controller.signal.aborted || projectOwnerKeyRef.current !== requestSessionKey) {
                    restoredUrls.forEach((url) => URL.revokeObjectURL(url));
                    return;
                }
                restoredUrls.forEach((url) => {
                    URL.revokeObjectURL(url);
                    multiObjectUrlsRef.current.delete(url);
                });
                if (uploadedObjectUrlRef.current && restoredUrls.includes(uploadedObjectUrlRef.current)) uploadedObjectUrlRef.current = null;
                sourceRestoreMessage = 'Chưa khôi phục được ảnh nguồn từ Backend. Đọc lại dự án để thử lại.';
            }
            setProjectState({ ownerKey: requestSessionKey, phase: 'loaded', projectId: projectIdFromUrl, project, sourceImageAvailable, sourceMultiFilesAvailable, sourceRestoreMessage, message: 'Đã đọc dự án đã được Backend xác nhận.' });
        }).catch((error) => {
            if (controller.signal.aborted || projectOwnerKeyRef.current !== requestSessionKey) return;
            setProjectState({
                ownerKey: requestSessionKey,
                phase: 'error',
                projectId: projectIdFromUrl,
                project: null,
                message: getProjectErrorMessage(error, 'read'),
            });
        });

        return () => {
            controller.abort();
            if (projectReadRequestRef.current === controller) projectReadRequestRef.current = null;
        };
    }, [authLoading, generationSessionKey, persistedGenerationOwnerKey, projectIdFromUrl, projectReadRevision, user]);

    useEffect(() => {
        if (authLoading || !user || !persistedGenerationOwnerKey || !confirmedProjectId) {
            setPipelineState({ ownerKey: generationSessionKey, projectId: '', phase: 'idle', pipeline: null, message: '', automaticReadCount: 0, pollingStopped: null });
            return undefined;
        }

        const requestOwnerKey = generationSessionKey;
        const projectId = confirmedProjectId;
        const pipelineController = new AbortController();
        pipelineReadRequestRef.current?.abort();
        pipelineReadRequestRef.current = pipelineController;
        const requestGeneration = ++pipelineGenerationRef.current;
        let automaticReadCount = 1;
        let pollTimer = null;
        let cancelled = false;
        let readInProgress = false;
        let latestPipeline = null;

        const isCurrentRequest = () => !cancelled
            && !pipelineController.signal.aborted
            && pipelineGenerationRef.current === requestGeneration
            && projectOwnerKeyRef.current === requestOwnerKey
            && projectIdFromUrlRef.current === projectId;

        const updateCurrentPipelineState = (update) => {
            if (!isCurrentRequest()) return;
            setPipelineState((current) => {
                if (current.ownerKey !== requestOwnerKey || current.projectId !== projectId) return current;
                return typeof update === 'function' ? update(current) : update;
            });
        };

        const pauseForBackground = () => {
            if (document.visibilityState !== 'hidden' || cancelled || (!readInProgress && pollTimer === null)) return;
            cancelled = true;
            if (pollTimer !== null) {
                window.clearTimeout(pollTimer);
                pollTimer = null;
            }
            setPipelineState((current) => {
                if (current.ownerKey !== requestOwnerKey || current.projectId !== projectId) return current;
                return {
                    ...current,
                    phase: 'paused',
                    pipeline: current.pipeline || latestPipeline,
                    pollingStopped: 'background',
                    message: 'Đã tạm dừng đọc Pipeline khi tab chạy nền. Chọn đọc lại để cập nhật.',
                };
            });
            pipelineController.abort();
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') pauseForBackground();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        setPipelineState({
            ownerKey: requestOwnerKey,
            projectId,
            phase: 'loading',
            pipeline: null,
            message: 'Đang đọc trạng thái Pipeline từ Backend…',
            automaticReadCount,
            pollingStopped: null,
        });

        const scheduleNextRead = (pipeline) => {
            if (!hasActivePipelineJobs(pipeline)) return;
            if (document.visibilityState === 'hidden') {
                pauseForBackground();
                return;
            }
            if (!shouldContinuePipelinePolling(pipeline, automaticReadCount, true)) {
                updateCurrentPipelineState((current) => ({ ...current, pollingStopped: 'limit' }));
                return;
            }
            pollTimer = window.setTimeout(() => {
                pollTimer = null;
                if (!isCurrentRequest()) return;
                if (document.visibilityState === 'hidden') {
                    pauseForBackground();
                    return;
                }
                automaticReadCount += 1;
                void readPipeline(true);
            }, PIPELINE_POLL_INTERVAL_MS);
        };

        const readPipeline = async (automatic = false) => {
            if (readInProgress || !isCurrentRequest()) return;
            readInProgress = true;
            updateCurrentPipelineState((current) => ({
                ...current,
                phase: 'loading',
                pipeline: current.pipeline || latestPipeline,
                message: automatic ? 'Đang cập nhật trạng thái Pipeline…' : 'Đang đọc trạng thái Pipeline từ Backend…',
                automaticReadCount,
                pollingStopped: null,
            }));
            try {
                const response = await getAIStudioProjectPipeline(projectId, { signal: pipelineController.signal });
                if (!isCurrentRequest()) return;
                const pipeline = normalizeProjectPipeline(response, projectId);
                if (!pipeline) {
                    updateCurrentPipelineState({
                        ownerKey: requestOwnerKey,
                        projectId,
                        phase: 'error',
                        pipeline: null,
                        message: 'Backend trả về dữ liệu Pipeline chưa hợp lệ. Bạn có thể thử đọc lại.',
                        automaticReadCount,
                        pollingStopped: 'invalid',
                    });
                    return;
                }
                latestPipeline = pipeline;
                const phase = pipeline.referenceVersions.length === 0
                    && pipeline.modelVersions.length === 0
                    && pipeline.jobs.length === 0
                    ? 'empty'
                    : 'ready';
                updateCurrentPipelineState({
                    ownerKey: requestOwnerKey,
                    projectId,
                    phase,
                    pipeline,
                    message: '',
                    automaticReadCount,
                    pollingStopped: null,
                });
                scheduleNextRead(pipeline);
            } catch (error) {
                if (!isCurrentRequest()) return;
                const classification = classifyPipelineReadError(error);
                updateCurrentPipelineState({
                    ownerKey: requestOwnerKey,
                    projectId,
                    phase: classification.phase,
                    pipeline: null,
                    message: classification.message,
                    automaticReadCount,
                    pollingStopped: 'error',
                });
            } finally {
                readInProgress = false;
            }
        };

        void readPipeline();

        return () => {
            cancelled = true;
            if (pollTimer !== null) window.clearTimeout(pollTimer);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            pipelineController.abort();
            if (pipelineReadRequestRef.current === pipelineController) pipelineReadRequestRef.current = null;
            if (pipelineGenerationRef.current === requestGeneration) pipelineGenerationRef.current += 1;
        };
    }, [authLoading, confirmedProjectId, generationSessionKey, persistedGenerationOwnerKey, pipelineReadRevision, user]);

    useEffect(() => {
        if (!confirmedProjectId || !user || !persistedGenerationOwnerKey || authLoading) {
            setTimelineState({ ownerKey: generationSessionKey, projectId: '', phase: 'idle', timeline: null, message: '' });
            return undefined;
        }
        const requestOwnerKey = generationSessionKey;
        const projectId = confirmedProjectId;
        const controller = new AbortController();
        setTimelineState({ ownerKey: requestOwnerKey, projectId, phase: 'loading', timeline: null, message: 'Đang đọc lịch sử phiên bản từ Backend…' });
        getAIStudioProjectTimeline(projectId, { signal: controller.signal }).then((response) => {
            if (controller.signal.aborted || projectOwnerKeyRef.current !== requestOwnerKey || projectIdFromUrlRef.current !== projectId) return;
            const timeline = normalizeProjectTimeline(response, projectId);
            if (!timeline) {
                setTimelineState({ ownerKey: requestOwnerKey, projectId, phase: 'invalid', timeline: null, message: 'Backend trả về Timeline chưa hợp lệ.' });
                return;
            }
            setTimelineState({ ownerKey: requestOwnerKey, projectId, phase: 'ready', timeline, message: '' });
        }).catch(() => {
            if (controller.signal.aborted || projectOwnerKeyRef.current !== requestOwnerKey || projectIdFromUrlRef.current !== projectId) return;
            setTimelineState({ ownerKey: requestOwnerKey, projectId, phase: 'error', timeline: null, message: 'Chưa đọc được Timeline từ Backend. Bạn có thể thử đọc lại.' });
        });
        return () => controller.abort();
    }, [authLoading, confirmedProjectId, generationSessionKey, persistedGenerationOwnerKey, timelineReadRevision, user]);

    const selectedReferenceViewSignature = selectedReferenceVersion?.availableViews?.join('|') || '';
    const visibleTimeline = visibleTimelineState.phase === 'ready' ? visibleTimelineState.timeline : null;
    const referenceMetadata = getDesignReferenceViewMetadata(visibleTimeline, selectedReferenceVersion?.versionId);
    useEffect(() => {
        const version = selectedReferenceVersion;
        const projectId = confirmedProjectId;
        const requestOwnerKey = generationSessionKey;
        if (!projectId || !version || !user || !persistedGenerationOwnerKey || authLoading) {
            setReferenceViewState({ ownerKey: requestOwnerKey, projectId: '', versionId: '', phase: 'idle', items: [], message: '' });
            return undefined;
        }
        const controller = new AbortController();
        const createdUrls = [];
        const isCurrentRequest = () => !controller.signal.aborted
            && projectOwnerKeyRef.current === requestOwnerKey
            && projectIdFromUrlRef.current === projectId;
        if (!hasCompleteReferenceViewSlots(version.availableViews)) {
            setReferenceViewState({ ownerKey: requestOwnerKey, projectId, versionId: version.versionId, phase: 'invalid', items: [], message: 'Phiên bản ảnh tham chiếu thiếu góc hoặc có góc bị trùng; không thể duyệt.' });
            return undefined;
        }
        if (['idle', 'loading'].includes(visibleTimelineState.phase)) {
            setReferenceViewState({ ownerKey: requestOwnerKey, projectId, versionId: version.versionId, phase: 'loading', items: [], message: 'Đang xác minh metadata ảnh tham chiếu…' });
            return undefined;
        }
        if (visibleTimelineState.phase !== 'ready') {
            setReferenceViewState({ ownerKey: requestOwnerKey, projectId, versionId: version.versionId, phase: 'invalid', items: [], message: 'Chưa xác minh được Timeline của phiên bản ảnh tham chiếu; không thể duyệt.' });
            return undefined;
        }
        if (referenceMetadata.available && !referenceMetadata.valid) {
            setReferenceViewState({ ownerKey: requestOwnerKey, projectId, versionId: version.versionId, phase: 'invalid', items: [], message: 'Metadata phiên bản ảnh tham chiếu không khớp đủ bốn góc; không thể duyệt.' });
            return undefined;
        }
        setReferenceViewState({ ownerKey: requestOwnerKey, projectId, versionId: version.versionId, phase: 'loading', items: [], message: 'Đang đọc ảnh tham chiếu từ Backend…' });
        Promise.all(version.availableViews.map(async (slot) => {
            try {
                const blob = await getAIStudioProjectReferenceView(projectId, version.versionId, slot, { signal: controller.signal });
                if (!isCurrentRequest()) return null;
                const validation = await validateDesignReferenceImageBlob(blob, {
                    slot,
                    expectedMetadata: referenceMetadata.available ? referenceMetadata.bySlot.get(slot) : null,
                });
                if (!isCurrentRequest()) return null;
                if (!validation.valid) return { slot, phase: 'invalid', url: '', message: 'Backend trả về ảnh tham chiếu có MIME hoặc nội dung không hợp lệ.' };
                const url = URL.createObjectURL(blob);
                createdUrls.push(url);
                return { slot, phase: 'ready', url, mimeType: validation.mimeType, message: '' };
            } catch {
                if (!isCurrentRequest()) return null;
                return { slot, phase: 'error', url: '', message: 'Chưa tải được ảnh tham chiếu từ Backend.' };
            }
        })).then((items) => {
            if (!isCurrentRequest()) {
                createdUrls.forEach((url) => URL.revokeObjectURL(url));
                return;
            }
            const validItems = items.filter(Boolean);
            setReferenceViewState({
                ownerKey: requestOwnerKey,
                projectId,
                versionId: version.versionId,
                phase: validItems.some((item) => item.phase !== 'ready')
                    || !hasCompleteReferenceViewSlots(validItems.map((item) => item.slot)) ? 'partial' : 'ready',
                items: validItems,
                message: validItems.some((item) => item.phase !== 'ready') ? 'Một hoặc nhiều ảnh tham chiếu chưa thể đọc an toàn.' : '',
            });
        });
        return () => {
            controller.abort();
            createdUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [authLoading, confirmedProjectId, generationSessionKey, persistedGenerationOwnerKey, selectedReferenceVersion?.versionId, selectedReferenceViewSignature, visibleTimelineState.phase, visibleTimeline?.events, user]);

    useEffect(() => {
        const model = selectedModelVersion;
        const projectId = confirmedProjectId;
        const requestOwnerKey = generationSessionKey;
        if (!projectId || !model || !model.artifactAvailable || !user || !persistedGenerationOwnerKey || authLoading) {
                setModelArtifactState({ ownerKey: requestOwnerKey, projectId: '', modelVersionId: '', phase: 'idle', url: '', viewerUrl: '', sha256: '', message: '' });
            return undefined;
        }
        const controller = new AbortController();
        let artifactUrl = '';
        const isCurrentRequest = () => !controller.signal.aborted
            && projectOwnerKeyRef.current === requestOwnerKey
            && projectIdFromUrlRef.current === projectId;
        setModelArtifactState({ ownerKey: requestOwnerKey, projectId, modelVersionId: model.modelVersionId, phase: 'loading', url: '', viewerUrl: '', message: 'Đang tải GLB riêng tư từ Backend…' });
        getAIStudioProjectModelArtifact(projectId, model.modelVersionId, { signal: controller.signal }).then(async (blob) => {
            if (!isCurrentRequest()) return;
            const validation = await validateDesignModelArtifactBlob(blob);
            if (!isCurrentRequest()) return;
            if (!validation.valid) {
                setModelArtifactState({ ownerKey: requestOwnerKey, projectId, modelVersionId: model.modelVersionId, phase: 'invalid', url: '', viewerUrl: '', sha256: '', message: 'Artifact từ Backend không phải GLB v2 hợp lệ; model chưa được mở trong Viewer.' });
                return;
            }
            artifactUrl = URL.createObjectURL(blob);
            setModelArtifactState({ ownerKey: requestOwnerKey, projectId, modelVersionId: model.modelVersionId, phase: 'validated', url: artifactUrl, viewerUrl: `${artifactUrl}#design-model.glb`, sha256: validation.sha256, message: 'GLB đã parse và kiểm tra hình học; đang xác nhận tải trong Viewer…' });
        }).catch(() => {
            if (!isCurrentRequest()) return;
            setModelArtifactState({ ownerKey: requestOwnerKey, projectId, modelVersionId: model.modelVersionId, phase: 'error', url: '', viewerUrl: '', sha256: '', message: 'Chưa tải được artifact GLB từ Backend.' });
        });
        return () => {
            controller.abort();
            if (artifactUrl) URL.revokeObjectURL(artifactUrl);
        };
    }, [authLoading, confirmedProjectId, generationSessionKey, persistedGenerationOwnerKey, selectedModelVersion?.artifactAvailable, selectedModelVersion?.modelVersionId, user]);

    useEffect(() => {
        const model = selectedModelVersion;
        const projectId = confirmedProjectId;
        const requestOwnerKey = generationSessionKey;
        const artifactMatches = modelArtifactState.ownerKey === requestOwnerKey
            && modelArtifactState.projectId === projectId
            && modelArtifactState.modelVersionId === model?.modelVersionId
            && modelArtifactState.phase === 'ready';
        if (!projectId || !model || !artifactMatches || !user || !persistedGenerationOwnerKey || authLoading) {
            setPrintReadinessState({ ownerKey: requestOwnerKey, projectId: '', modelVersionId: '', phase: 'idle', data: null, message: '' });
            return undefined;
        }
        const controller = new AbortController();
        const isCurrentRequest = () => !controller.signal.aborted
            && projectOwnerKeyRef.current === requestOwnerKey
            && projectIdFromUrlRef.current === projectId
            && selectedModelVersionIdRef.current === model.modelVersionId;
        setPrintReadinessState({ ownerKey: requestOwnerKey, projectId, modelVersionId: model.modelVersionId, phase: 'loading', data: null, message: 'Đang xác minh Print Readiness từ Backend…' });
        getAIStudioProjectModelPrintReadiness(projectId, model.modelVersionId, { signal: controller.signal }).then((response) => {
            if (!isCurrentRequest()) return;
            const normalized = normalizeAIStudioPrintReadiness(response, projectId, model.modelVersionId);
            if (normalized.phase === 'invalid') {
                setPrintReadinessState({ ownerKey: requestOwnerKey, projectId, modelVersionId: model.modelVersionId, phase: 'invalid', data: null, message: 'Backend trả về Print Readiness không đầy đủ hoặc không khớp version/digest.' });
                return;
            }
            if (normalized.phase === 'ready' && normalized.artifactSha256 !== modelArtifactState.sha256) {
                setPrintReadinessState({ ownerKey: requestOwnerKey, projectId, modelVersionId: model.modelVersionId, phase: 'invalid', data: null, message: 'Digest artifact tải về không khớp digest đã đo; bước chuẩn bị in bị khóa.' });
                return;
            }
            setPrintReadinessState({
                ownerKey: requestOwnerKey,
                projectId,
                modelVersionId: model.modelVersionId,
                phase: normalized.phase,
                data: normalized,
                message: normalized.phase === 'not-ready'
                    ? `Backend chưa cho phép chuẩn bị in (reasonCode: ${normalized.reasonCode}).`
                    : '',
            });
        }).catch((error) => {
            if (!isCurrentRequest()) return;
            setPrintReadinessState({ ownerKey: requestOwnerKey, projectId, modelVersionId: model.modelVersionId, phase: 'error', data: null, message: getPrintReadinessErrorMessage(error) });
        });
        return () => controller.abort();
    }, [authLoading, confirmedProjectId, generationSessionKey, modelArtifactState.ownerKey, modelArtifactState.projectId, modelArtifactState.modelVersionId, modelArtifactState.phase, modelArtifactState.sha256, persistedGenerationOwnerKey, printReadinessReadRevision, selectedModelVersion?.modelVersionId, selectedModelVersion?.status, user]);

    const handleDesignModelLoadState = useCallback((result) => {
        const current = modelArtifactStateRef.current;
        if (current.ownerKey !== generationSessionKey || current.projectId !== confirmedProjectId
            || current.modelVersionId !== selectedModelVersion?.modelVersionId || !current.url) return;
        if (result?.phase === 'ready') {
            setModelArtifactState((state) => state.ownerKey === current.ownerKey && state.projectId === current.projectId
                && state.modelVersionId === current.modelVersionId && state.url === current.url && state.phase === 'validated'
                ? { ...state, phase: 'ready', message: '' } : state);
            return;
        }
        if (result?.phase === 'error') {
            URL.revokeObjectURL(current.url);
            setModelArtifactState((state) => state.ownerKey === current.ownerKey && state.projectId === current.projectId
                && state.modelVersionId === current.modelVersionId && state.url === current.url
                ? { ...state, phase: 'invalid', url: '', viewerUrl: '', message: 'Viewer không thể tải hoặc xác minh scene GLB; model chưa thể được duyệt.' }
                : state);
        }
    }, [confirmedProjectId, generationSessionKey, selectedModelVersion?.modelVersionId]);

    function retryPrintReadiness() {
        setPrintReadinessReadRevision((revision) => revision + 1);
    }

    function openDesignProjectPrintPreparation() {
        const readiness = visiblePrintReadinessState.data;
        const model = selectedModelVersion;
        if (visiblePrintReadinessState.phase !== 'ready'
            || readiness?.readiness !== 'READY'
            || readiness.projectId !== confirmedProjectId
            || readiness.modelVersionId !== model?.modelVersionId
            || visibleModelArtifactState.phase !== 'ready'
            || visibleModelArtifactState.sha256 !== readiness.artifactSha256) return;
        const title = 'Mô hình Design Project';
        const artifactPath = `/api${API_ROUTES.aiStudio.projectModelArtifact(confirmedProjectId, model.modelVersionId)}#design-model.glb`;
        navigate('/print-quote', {
            state: {
                printDraft: {
                    id: `${confirmedProjectId}:${model.modelVersionId}`,
                    projectId: readiness.projectId,
                    modelVersionId: readiness.modelVersionId,
                    title,
                    productName: title,
                    modelUrl: artifactPath,
                    artifactSha256: readiness.artifactSha256,
                    format: 'glb',
                    dimensions: readiness.dimensionsMm,
                    printReadiness: readiness.readiness,
                    dimensionSource: readiness.dimensionSource,
                    dimensionMethod: readiness.dimensionMethod,
                    measuredAt: readiness.measuredAt,
                    provenanceId: readiness.provenanceId,
                    measurementModelVersionId: readiness.measurementModelVersionId,
                    measurementArtifactSha256: readiness.measurementArtifactSha256,
                },
            },
        });
    }

    useEffect(() => () => generationRequestRef.current?.abort(), []);

    useEffect(() => () => {
        if (uploadedObjectUrlRef.current) {
            URL.revokeObjectURL(uploadedObjectUrlRef.current);
            uploadedObjectUrlRef.current = null;
        }
    }, []);

    useEffect(() => () => {
        multiObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        multiObjectUrlsRef.current.clear();
        multiHashTasksRef.current.clear();
    }, []);

    function releaseUploadedObjectUrl() {
        if (!uploadedObjectUrlRef.current) return;
        URL.revokeObjectURL(uploadedObjectUrlRef.current);
        uploadedObjectUrlRef.current = null;
    }

    function setUploadedFile(file) {
        clearUploadedFile();
        const validationError = validateStudioImage(file);
        if (validationError) {
            setUploadError(validationError);
            return;
        }

        const nextUrl = URL.createObjectURL(file);
        uploadedObjectUrlRef.current = nextUrl;
        setUploadedImg(nextUrl);
        setUploadedFileState(file);
        setUploadError('');
        setIsPreparingImage(true);
        const taskId = uploadFingerprintTaskRef.current;
        getImageContentSha256(file).then((digest) => {
            if (uploadFingerprintTaskRef.current !== taskId) return;
            setImageContentSha256(digest);
            setIsPreparingImage(false);
        }).catch(() => {
            if (uploadFingerprintTaskRef.current !== taskId) return;
            clearUploadedFile();
            setUploadError('Không thể xác định nội dung ảnh trong trình duyệt. Hãy chọn lại ảnh.');
        });
    }

    function clearUploadedFile() {
        uploadFingerprintTaskRef.current += 1;
        releaseUploadedObjectUrl();
        setUploadedImg(null);
        setUploadedFileState(null);
        setImageContentSha256(null);
        setIsPreparingImage(false);
        setUploadError('');
        localProjectIdRef.current = null;
        localProjectImageSha256Ref.current = null;
        setProjectState((current) => current.project?.inputMode === 'image'
            ? { ...current, sourceImageAvailable: false }
            : current);
    }

    function updateMultiViews(update) {
        const next = update(multiViewsRef.current);
        multiViewsRef.current = next;
        setMultiViews(next);
    }

    function invalidateProjectInput() {
        projectInputRevisionRef.current += 1;
        setProjectInputRevision(projectInputRevisionRef.current);
        setPreparedMultiIdentity(null);
    }

    function updateProjectInput(setter, value) {
        invalidateProjectInput();
        setter(value);
    }

    function handleMultiViewFile(slotId, file) {
        if (!file) return;
        const validationError = validateStudioImage(file);
        if (validationError) {
            setMultiUploadError(validationError);
            return;
        }
        invalidateProjectInput();

        const previous = multiViewsRef.current[slotId];
        if (previous?.url) {
            URL.revokeObjectURL(previous.url);
            multiObjectUrlsRef.current.delete(previous.url);
        }
        const url = URL.createObjectURL(file);
        multiObjectUrlsRef.current.add(url);
        localProjectIdRef.current = null;
        localProjectMultiFingerprintRef.current = null;
        setProjectState((current) => current.project?.inputMode === 'multi'
            ? { ...current, sourceMultiFilesAvailable: false }
            : current);
        const taskId = ++multiHashTaskIdRef.current;
        multiHashTasksRef.current.set(slotId, taskId);
        setPendingMultiHashes(multiHashTasksRef.current.size);
        updateMultiViews((current) => ({ ...current, [slotId]: { file, url, sha256: null } }));
        setMultiUploadError('');

        getImageContentSha256(file).then((sha256) => {
            if (multiHashTasksRef.current.get(slotId) !== taskId || multiViewsRef.current[slotId]?.file !== file) return;
            updateMultiViews((current) => ({ ...current, [slotId]: { ...current[slotId], sha256 } }));
        }).catch(() => {
            if (multiHashTasksRef.current.get(slotId) !== taskId || multiViewsRef.current[slotId]?.file !== file) return;
            removeMultiView(slotId);
            setMultiUploadError('Không thể xác định nội dung ảnh trong trình duyệt. Hãy chọn lại ảnh.');
        }).finally(() => {
            if (multiHashTasksRef.current.get(slotId) === taskId) {
                multiHashTasksRef.current.delete(slotId);
                setPendingMultiHashes(multiHashTasksRef.current.size);
            }
        });
    }

    function removeMultiView(slotId) {
        invalidateProjectInput();
        const previous = multiViewsRef.current[slotId];
        if (previous?.url) {
            URL.revokeObjectURL(previous.url);
            multiObjectUrlsRef.current.delete(previous.url);
        }
        multiHashTasksRef.current.delete(slotId);
        setPendingMultiHashes(multiHashTasksRef.current.size);
        setMultiUploadError('');
        localProjectIdRef.current = null;
        localProjectMultiFingerprintRef.current = null;
        setProjectState((current) => current.project?.inputMode === 'multi'
            ? { ...current, sourceMultiFilesAvailable: false }
            : current);
        updateMultiViews((current) => {
            const next = { ...current };
            delete next[slotId];
            return next;
        });
    }

    function addExtraViewSlot() {
        if (extraViewSlots.length >= 4) return;
        invalidateProjectInput();
        setExtraViewSlots((current) => {
            if (current.length >= 4) return current;
            const nextNumber = current.length + 1;
            return [...current, { id: `extra-${nextNumber}`, label: `Góc bổ sung ${nextNumber}` }];
        });
    }

    function clearMultiViews() {
        invalidateProjectInput();
        multiObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        multiObjectUrlsRef.current.clear();
        multiHashTasksRef.current.clear();
        multiViewsRef.current = {};
        setMultiViews({});
        setExtraViewSlots([]);
        setMultiUploadError('');
        setPendingMultiHashes(0);
        setProjectState((current) => current.project?.inputMode === 'multi'
            ? { ...current, sourceMultiFilesAvailable: false }
            : current);
        localProjectMultiFingerprintRef.current = null;
    }

    function resetCustomization(item) {
        const parts = Array.isArray(item?.parts) ? item.parts : [];
        dispatchViewerCustomization({ type: 'reset-for-model', parts });
    }

    function handleViewerCustomizationChange(customization) {
        dispatchViewerCustomization({ type: 'viewer-change', customization });
    }

    const apiInputMode = getStudioApiInputMode(inputMode);
    const hasInput = apiInputMode === 'text'
        ? textPrompt.trim().length > 0
        : apiInputMode === 'image' && Boolean(uploadedImg);

    async function handleSaveProject() {
        if (authLoading) return;
        if (!user || !persistedGenerationOwnerKey) {
            setProjectState({ ownerKey: generationSessionKey, phase: 'auth-required', projectId: '', project: null, message: 'Vui lòng đăng nhập để lưu dự án vào tài khoản của bạn.' });
            return;
        }
        if (!['text', 'image', 'multi'].includes(inputMode)) {
            setProjectState({ ownerKey: generationSessionKey, phase: 'validation-error', projectId: '', project: null, message: 'Chế độ đầu vào này chưa thể lưu Design Project.' });
            return;
        }
        if (inputMode === 'image' && !uploadedFile) {
            setProjectState({ ownerKey: generationSessionKey, phase: 'validation-error', projectId: '', project: null, message: 'Vui lòng tải lên một ảnh hợp lệ trước khi lưu dự án.' });
            return;
        }
        if (inputMode === 'image' && (!imageContentSha256 || isPreparingImage)) {
            setProjectState({ ownerKey: generationSessionKey, phase: 'validation-error', projectId: '', project: null, message: 'Đang chuẩn bị ảnh. Vui lòng đợi trước khi lưu dự án.' });
            return;
        }
        if (inputMode === 'multi' && pendingMultiHashes > 0) {
            setProjectState({ ownerKey: generationSessionKey, phase: 'validation-error', projectId: '', project: null, message: 'Đang chuẩn bị ảnh MULTI. Vui lòng đợi trước khi lưu dự án.' });
            return;
        }

        const request = inputMode === 'multi'
            ? buildMultiDesignProjectRequest({
                productType, keychainVariant, styleId: style, originalIdea: textPrompt,
                uploads: Object.entries(multiViewsRef.current).map(([slotId, upload]) => ({ slotId, ...upload })),
            })
            : inputMode === 'image'
                ? buildImageDesignProjectRequest({ productType, keychainVariant, styleId: style, originalIdea: textPrompt })
                : buildTextDesignProjectRequest({ productType, keychainVariant, styleId: style, originalIdea: textPrompt });
        const validationMessages = {
            product: 'Vui lòng chọn một loại sản phẩm.',
            keychainVariant: 'Vui lòng chọn loại móc khóa hợp lệ.',
            style: 'Vui lòng chọn phong cách hợp lệ cho sản phẩm.',
            idea: 'Vui lòng nhập ý tưởng trước khi lưu dự án.',
            'idea-too-long': 'Mô tả tối đa 4.000 ký tự.',
            'image-count': 'Chế độ MULTI cần từ 2 đến 8 ảnh hợp lệ.',
            slots: 'Danh sách góc ảnh không hợp lệ. Hãy chọn lại ảnh trong từng góc.',
        };
        if (request.error) {
            setProjectState({ ownerKey: generationSessionKey, phase: 'validation-error', projectId: '', project: null, message: validationMessages[request.error] });
            return;
        }
        const accountKey = persistedGenerationOwnerKey;
        const storageKey = `2dto3d.ai-studio.project-idempotency:${accountKey}`;
        const savedState = readStoredProjectRequest(accountKey, projectIdempotencyKeysRef.current);
        const savedRequest = savedState.record;
        const requiresManualReconciliation = savedState.classification === 'unknown'
            || (inputMode === 'multi' && ['legacy-fnv', 'legacy-multi-v2'].includes(savedState.classification));
        if (requiresManualReconciliation) {
            setProjectState({
                ownerKey: generationSessionKey,
                phase: 'reconciliation-required',
                projectId: '',
                project: null,
                message: getProjectReconciliationMessage(savedState.classification),
            });
            return;
        }
        const requestContentFingerprint = inputMode === 'image'
            ? imageContentSha256
            : inputMode === 'multi'
                ? JSON.stringify(request.uploads.map(({ slotId, sha256 }) => ({ slotId, sha256 })))
                : null;
        const requestImageHashes = inputMode === 'multi'
            ? request.uploads.map(({ slotId, sha256 }) => ({ slotId, sha256 }))
            : null;
        if (inputMode === 'multi' && requestImageHashes.some(({ sha256 }) => !/^[a-f0-9]{64}$/.test(sha256 || ''))) {
            setProjectState({ ownerKey: generationSessionKey, phase: 'validation-error', projectId: '', project: null, message: 'Đang chuẩn bị nội dung ảnh MULTI. Vui lòng đợi rồi thử lại.' });
            return;
        }
        if (!claimDesignProjectSave(projectInFlightOwnersRef.current, generationOwnerKey)) return;

        const requestSessionKey = generationSessionKey;
        const requestOwnerKey = generationOwnerKey;
        const requestRevision = projectInputRevisionRef.current;
        const controller = new AbortController();
        projectCreateRequestRef.current?.abort();
        projectCreateRequestRef.current = controller;
        setProjectSavingOwnerKey(requestSessionKey);
        setProjectState({ ownerKey: requestSessionKey, phase: 'saving', projectId: '', project: null, message: inputMode === 'multi' ? 'Đang xác minh dấu vân tay an toàn cho yêu cầu MULTI…' : 'Đang lưu thông tin dự án vào Backend…' });
        let createRequestSent = false;
        let keyRecord = null;
        try {
            keyRecord = inputMode === 'multi'
                ? await createMultiDesignProjectIdempotencyRecord(request.data, savedRequest, createIdempotencyKey, requestImageHashes)
                : createDesignProjectIdempotencyRecord(request.data, savedRequest, createIdempotencyKey, requestContentFingerprint);
            if (controller.signal.aborted || projectOwnerKeyRef.current !== requestSessionKey) return;
            if (projectInputRevisionRef.current !== requestRevision) {
                setProjectState({ ownerKey: requestSessionKey, phase: 'validation-error', projectId: '', project: null, message: 'Lựa chọn đã thay đổi trong lúc xác minh. Hãy lưu lại với dữ liệu hiện tại.' });
                return;
            }
            projectIdempotencyKeysRef.current.set(accountKey, keyRecord);
            try {
                window.sessionStorage.setItem(storageKey, JSON.stringify(keyRecord));
            } catch {
                if (inputMode === 'multi') {
                    projectIdempotencyKeysRef.current.delete(accountKey);
                    setProjectState({ ownerKey: requestSessionKey, phase: 'validation-error', projectId: '', project: null, message: 'Không thể lưu an toàn khóa MULTI trong phiên trình duyệt. Yêu cầu chưa được gửi.' });
                    return;
                }
                /* TEXT/IMAGE keep their existing in-memory fallback. */
            }
            const requestFiles = inputMode === 'multi' ? request.files : inputMode === 'image' ? [uploadedFile] : [];
            createRequestSent = true;
            const response = await createAIStudioProject(request.data, requestFiles, keyRecord.key, { signal: controller.signal });
            if (controller.signal.aborted || projectOwnerKeyRef.current !== requestSessionKey) return;
            const projectId = getCreatedDesignProjectId(response);
            if (!projectId) {
                setProjectState({ ownerKey: requestSessionKey, phase: 'indeterminate', projectId: '', project: null, requestFingerprint: keyRecord.fingerprint, message: 'Backend đã phản hồi nhưng chưa trả về Project ID hợp lệ. Giữ nguyên khóa để gửi lại an toàn.' });
                return;
            }

            projectIdempotencyKeysRef.current.delete(accountKey);
            try { window.sessionStorage.removeItem(storageKey); } catch { /* The completed project ID is now available in the URL. */ }
            setProjectState({ ownerKey: requestSessionKey, phase: 'loading', projectId, project: null, message: 'Backend đã nhận yêu cầu lưu. Đang đọc lại dự án…' });
            localProjectIdRef.current = projectId;
            localProjectImageSha256Ref.current = inputMode === 'image' ? imageContentSha256 : null;
            localProjectMultiFingerprintRef.current = inputMode === 'multi' ? requestContentFingerprint : null;
            setProjectReadRevision((revision) => revision + 1);
            setProjectHistoryReloadRevision((revision) => revision + 1);
            const search = new URLSearchParams(location.search);
            search.set('projectId', projectId);
            navigate({ pathname: location.pathname, search: `?${search.toString()}`, hash: location.hash }, { replace: true });
        } catch (error) {
            if (controller.signal.aborted || projectOwnerKeyRef.current !== requestSessionKey) return;
            if (!createRequestSent) {
                setProjectState({ ownerKey: requestSessionKey, phase: 'validation-error', projectId: '', project: null, message: 'Không thể xác minh an toàn dấu vân tay ảnh MULTI. Yêu cầu chưa được gửi; hãy thử lại khi trình duyệt hỗ trợ Web Crypto.' });
                return;
            }
            const classification = classifyDesignProjectRequestError(error);
            if (classification.outcome === 'rejected') {
                projectIdempotencyKeysRef.current.delete(accountKey);
                try { window.sessionStorage.removeItem(storageKey); } catch { /* Ignore unavailable storage. */ }
            }
            setProjectState({
                ownerKey: requestSessionKey,
                phase: classification.outcome === 'indeterminate' ? 'indeterminate' : 'error',
                projectId: '',
                project: null,
                requestFingerprint: classification.outcome === 'indeterminate' ? keyRecord.fingerprint : null,
                message: getProjectErrorMessage(error, 'save'),
            });
        } finally {
            releaseDesignProjectSave(projectInFlightOwnersRef.current, requestOwnerKey);
            if (projectCreateRequestRef.current === controller) projectCreateRequestRef.current = null;
            if (projectOwnerKeyRef.current === requestSessionKey) setProjectSavingOwnerKey(null);
        }
    }

    async function trackGeneration(jobId, requestOwnerKey, controller) {
        for (let attempt = 0; attempt < 20; attempt += 1) {
            await waitForPoll(POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)], controller.signal);
            const job = await getAIGeneration(jobId, { signal: controller.signal });
            if (generationOwnerKeyRef.current !== requestOwnerKey) return;
            const resolution = resolveGenerationResponse(job);
            if (resolution.state === 'pending') {
                setGenStatus(`Đang xử lý yêu cầu ${jobId}. Studio sẽ tự cập nhật trạng thái.`);
                continue;
            }
            if (resolution.state === 'failed') {
                setActiveJobId(null);
                dispatchGeneration({ type: 'failed' });
                setGenError(job.errorMessage || 'Backend báo tạo mô hình thất bại. Bạn có thể gửi lại yêu cầu.');
                setGenStatus('');
                return;
            }
            if (resolution.state !== 'completed') {
                setActiveJobId(null);
                dispatchGeneration({ type: 'invalid' });
                setGenError('Backend chưa xác nhận mô hình hoàn tất hoặc chưa trả về đường dẫn kết quả được bảo vệ.');
                return;
            }

            const generated = resolution.generation;
            setActiveJobId(null);
            dispatchGeneration({ type: 'completed' });
            dispatchGenerationResults({ type: 'completed', ownerKey: requestOwnerKey, generation: generated });
            resetCustomization(generated);
            setGenStatus('Mô hình đã được tạo và lưu trên Backend.');
            return;
        }
        dispatchGeneration({ type: 'pending' });
        setGenStatus(`Yêu cầu ${jobId} vẫn đang chạy. Chọn “Theo dõi mô hình” để kiểm tra lại.`);
    }

    async function handleGenerate() {
        if (!pendingOwnerReady || generationInFlightOwnersRef.current.has(generationOwnerKey)) return;
        if (!user) {
            setGenError('Vui lòng đăng nhập để tạo và lưu mô hình vào tài khoản của bạn.');
            return;
        }
        if (!activeJobId && !apiInputMode) {
            setGenError('Backend hiện hỗ trợ mô tả văn bản hoặc một ảnh tham chiếu; nhiều góc nhìn chưa được hỗ trợ.');
            return;
        }
        if (!activeJobId && !hasInput) {
            setGenError(inputMode === 'text' ? 'Vui lòng nhập mô tả mô hình.' : 'Vui lòng tải lên một hình ảnh.');
            return;
        }

        const requestOwnerKey = generationSessionKey;
        const requestGuardKey = generationOwnerKey;
        generationInFlightOwnersRef.current.add(requestGuardKey);
        const controller = new AbortController();
        generationRequestRef.current?.abort();
        generationRequestRef.current = controller;
        dispatchGeneration({ type: 'submit' });
        setGenerationMessageOwnerKey(requestOwnerKey);
        setGenError('');
        setGenStatus('');

        let trackingJobId = activeJobId;
        try {
            if (activeJobId) {
                dispatchGeneration({ type: 'track' });
                await trackGeneration(activeJobId, requestOwnerKey, controller);
                return;
            }

            const data = { prompt: textPrompt, style, inputMode: apiInputMode };
            let imageFile = null;
            if (inputMode === 'image' && uploadedImg) {
                const localImage = await fetch(uploadedImg, { signal: controller.signal });
                const blob = await localImage.blob();
                imageFile = new File([blob], 'input.png', { type: blob.type });
            }
            if (generationOwnerKeyRef.current !== requestOwnerKey) return;

            const storageKey = persistedGenerationOwnerKey
                ? `2dto3d.ai-studio.idempotency:${persistedGenerationOwnerKey}` : null;
            let idempotencyKey = idempotencyKeysRef.current.get(requestGuardKey);
            if (!idempotencyKey && storageKey) {
                try { idempotencyKey = window.sessionStorage.getItem(storageKey); } catch { idempotencyKey = null; }
            }
            if (!idempotencyKey) idempotencyKey = createIdempotencyKey();
            idempotencyKeysRef.current.set(requestGuardKey, idempotencyKey);
            try { if (storageKey) window.sessionStorage.setItem(storageKey, idempotencyKey); } catch { /* Keep the key in memory. */ }

            const result = await createAIGeneration(data, imageFile, idempotencyKey, { signal: controller.signal });
            if (generationOwnerKeyRef.current !== requestOwnerKey) return;
            const resolution = resolveGenerationResponse(result);
            if (resolution.state === 'pending' && result?.id) {
                setActiveJobId(result.id);
                trackingJobId = result.id;
                idempotencyKeysRef.current.delete(requestGuardKey);
                try { if (storageKey) window.sessionStorage.removeItem(storageKey); } catch { /* Job id is now server-owned. */ }
                setGenStatus(`Đã nhận yêu cầu ${result.id}. Đang theo dõi trạng thái Backend.`);
                await trackGeneration(result.id, requestOwnerKey, controller);
                return;
            }
            if (resolution.state === 'completed') {
                setActiveJobId(null);
                dispatchGenerationResults({ type: 'completed', ownerKey: requestOwnerKey, generation: resolution.generation });
                dispatchGeneration({ type: 'completed' });
                resetCustomization(resolution.generation);
                idempotencyKeysRef.current.delete(requestGuardKey);
                try { if (storageKey) window.sessionStorage.removeItem(storageKey); } catch { /* Ignore unavailable storage. */ }
                return;
            }
            throw new Error('Backend không trả về một generation job hợp lệ.');
        } catch (error) {
            if (controller.signal.aborted || generationOwnerKeyRef.current !== requestOwnerKey) return;
            const response = error?.response?.data;
            if (response?.accepted === false) {
                const storageKey = persistedGenerationOwnerKey
                    ? `2dto3d.ai-studio.idempotency:${persistedGenerationOwnerKey}` : null;
                idempotencyKeysRef.current.delete(requestGuardKey);
                try { if (storageKey) window.sessionStorage.removeItem(storageKey); } catch { /* Ignore unavailable storage. */ }
                setActiveJobId(null);
                dispatchGeneration({ type: 'failed' });
                setGenStatus('');
            } else if (trackingJobId) {
                dispatchGeneration({ type: 'pending' });
                setActiveJobId(trackingJobId);
                setGenStatus(`Chưa tải được trạng thái yêu cầu ${trackingJobId}. Chọn “Theo dõi mô hình” để thử lại.`);
            } else {
                dispatchGeneration({ type: 'indeterminate' });
                setGenStatus('Chưa xác nhận được yêu cầu. Chọn “Gửi lại an toàn” để gửi lại cùng khóa idempotency.');
            }
            setGenError(getErrorMessage(error));
        } finally {
            generationInFlightOwnersRef.current.delete(requestGuardKey);
            if (generationRequestRef.current === controller) generationRequestRef.current = null;
        }
    }

    function handleSelectGeneration(item) {
        if (!item) return;
        const stored = sessionHistory.find(candidate => (
            (candidate.id ?? candidate.modelUrl) === (item.id ?? item.modelUrl)
        ));
        if (!stored || resolveGenerationResponse(stored).state !== 'completed') return;
        dispatchGenerationResults({ type: 'select-history', ownerKey: generationSessionKey, generation: stored });
        resetCustomization(stored);
    }

    async function handleLoadMoreProjects() {
        const current = projectHistoryStateRef.current;
        const requestOwnerKey = generationSessionKey;
        if (!user || !persistedGenerationOwnerKey
            || current.ownerKey !== requestOwnerKey
            || current.phase !== 'ready'
            || current.last) return;
        const nextPage = current.page + 1;
        if (projectHistoryPageInFlightRef.current === nextPage) return;

        projectHistoryPageInFlightRef.current = nextPage;
        const controller = new AbortController();
        projectHistoryPageRequestRef.current?.abort();
        projectHistoryPageRequestRef.current = controller;
        setProjectHistoryState((state) => state.ownerKey === requestOwnerKey
            ? { ...state, loadingMore: true, pageError: '' }
            : state);
        try {
            const response = await getAIStudioProjectHistory(nextPage, PROJECT_HISTORY_PAGE_SIZE, { signal: controller.signal });
            if (controller.signal.aborted || projectHistoryOwnerKeyRef.current !== requestOwnerKey) return;
            const page = normalizeDesignProjectHistoryPage(response, nextPage, PROJECT_HISTORY_PAGE_SIZE);
            if (!page) {
                setProjectHistoryState((state) => state.ownerKey === requestOwnerKey
                    ? { ...state, loadingMore: false, pageError: 'Backend trả về trang dự án chưa hợp lệ. Bạn có thể thử tải lại trang này.' }
                    : state);
                return;
            }
            setProjectHistoryState((state) => state.ownerKey === requestOwnerKey ? {
                ...state,
                phase: 'ready',
                items: mergeDesignProjectHistoryPages(state.items, page.content),
                page: page.page,
                size: page.size,
                totalElements: page.totalElements,
                totalPages: page.totalPages,
                last: page.last,
                loadingMore: false,
                pageError: '',
            } : state);
        } catch (error) {
            if (controller.signal.aborted || projectHistoryOwnerKeyRef.current !== requestOwnerKey) return;
            const classification = classifyProjectHistoryError(error);
            setProjectHistoryState((state) => state.ownerKey === requestOwnerKey
                ? { ...state, loadingMore: false, pageError: classification.message }
                : state);
        } finally {
            if (projectHistoryPageRequestRef.current === controller) {
                projectHistoryPageRequestRef.current = null;
                if (projectHistoryPageInFlightRef.current === nextPage) projectHistoryPageInFlightRef.current = null;
            }
        }
    }

    function handleOpenProjectSummary(project) {
        if (!user || !persistedGenerationOwnerKey || !project?.projectId) return;
        if (project.projectId === projectIdFromUrl) {
            setProjectReadRevision((revision) => revision + 1);
            setPipelineReadRevision((revision) => revision + 1);
            return;
        }
        const search = new URLSearchParams(location.search);
        search.delete('mode');
        search.set('projectId', project.projectId);
        navigate({ pathname: location.pathname, search: `?${search.toString()}`, hash: location.hash });
    }

    async function runDesignProjectCommand({
        operation,
        payload,
        send,
        validateResponse,
        versionId = '',
        acceptedVersionField = '',
        acceptedMessage,
    }) {
        if (!isProjectAuthenticated || !confirmedProjectId || visibleProjectState.phase !== 'loaded') return;
        if (workflowMutationInFlightRef.current) return;
        const ownerKey = generationSessionKey;
        const projectId = confirmedProjectId;
        const controller = new AbortController();
        const request = { ownerKey, projectId, versionId, controller };
        workflowMutationRequestRef.current = request;
        workflowMutationInFlightRef.current = true;
        setWorkflowCommandState({ ownerKey, projectId, phase: 'submitting', operation, message: 'Đang gửi lệnh đến Backend…' });
        try {
            const command = await getOrCreateDesignCommandKey(
                window.sessionStorage,
                ownerKey,
                projectId,
                operation,
                payload,
            );
            request.command = command;
            if (controller.signal.aborted || workflowMutationRequestRef.current !== request) return;
            if (!command.key) {
                setWorkflowCommandState({
                    ownerKey,
                    projectId,
                    phase: 'blocked',
                    operation,
                    message: 'Có lệnh trước chưa được Backend xác nhận. Chỉ có thể thử lại đúng nội dung cũ bằng Idempotency-Key đã lưu.',
                });
                return;
            }
            const response = await send(command.key, { signal: controller.signal });
            const selectedVersionStillMatches = !versionId
                || selectedReferenceVersionIdRef.current === versionId
                || selectedModelVersionIdRef.current === versionId;
            if (controller.signal.aborted
                || workflowMutationRequestRef.current !== request
                || projectOwnerKeyRef.current !== ownerKey
                || projectIdFromUrlRef.current !== projectId
                || !selectedVersionStillMatches) return;

            if (!validateResponse(response)) {
                setWorkflowCommandState({
                    ownerKey,
                    projectId,
                    phase: 'uncertain',
                    operation,
                    message: 'Backend phản hồi nhưng chưa xác nhận đúng mã lệnh/trạng thái. Đang đọc lại Pipeline và Timeline.',
                });
                setPipelineReadRevision((revision) => revision + 1);
                setTimelineReadRevision((revision) => revision + 1);
                return;
            }
            markDesignCommandKeyOutcome(window.sessionStorage, command, 'accepted');
            const acceptedVersionId = acceptedVersionField && response?.[acceptedVersionField];
            if (operation.startsWith('references-generate') && isBackendUuid(acceptedVersionId)) {
                setSelectedReferenceVersionId(acceptedVersionId);
            } else if (operation.startsWith('models-generate') && isBackendUuid(acceptedVersionId)) {
                setSelectedModelVersionId(acceptedVersionId);
            }
            setWorkflowCommandState({
                ownerKey,
                projectId,
                phase: 'accepted',
                operation,
                message: acceptedMessage || 'Backend đã xác nhận lệnh. Kết quả sẽ hiển thị sau khi Pipeline xác nhận xử lý.',
            });
            setPipelineReadRevision((revision) => revision + 1);
            setTimelineReadRevision((revision) => revision + 1);
        } catch (error) {
            if (controller.signal.aborted || workflowMutationRequestRef.current !== request
                || projectOwnerKeyRef.current !== ownerKey || projectIdFromUrlRef.current !== projectId) return;
            const status = error?.response?.status;
            const errorCode = error?.response?.data?.code;
            if (request.command && ([400, 401, 403, 404, 422, 429].includes(status)
                || status === 409 && errorCode !== 'DESIGN_IDEMPOTENCY_CONFLICT')) {
                markDesignCommandKeyOutcome(window.sessionStorage, request.command, 'rejected');
            }
            setWorkflowCommandState({
                ownerKey,
                projectId,
                phase: status ? 'error' : 'uncertain',
                operation,
                message: getWorkflowCommandErrorMessage(error),
            });
            setPipelineReadRevision((revision) => revision + 1);
            setTimelineReadRevision((revision) => revision + 1);
        } finally {
            if (workflowMutationRequestRef.current === request) {
                workflowMutationRequestRef.current = null;
                workflowMutationInFlightRef.current = false;
            }
        }
    }

    function handleGenerateReferences({ viewSlot = null, revisionFeedback = null } = {}) {
        const payload = { viewSlot, revisionFeedback };
        const nextVersionNumber = (latestReferenceVersion?.versionNumber || 0) + 1;
        return runDesignProjectCommand({
            operation: 'references-generate-v' + nextVersionNumber,
            payload,
            send: (key, options) => generateAIStudioProjectReferences(confirmedProjectId, payload, key, options),
            validateResponse: (response) => isBackendUuid(response?.jobId)
                && isBackendUuid(response?.versionId)
                && response.projectStatus === 'REFERENCES_QUEUED',
            acceptedVersionField: 'versionId',
            acceptedMessage: 'Backend đã xếp lệnh tạo ảnh tham chiếu. HTTP 202 chưa đồng nghĩa ảnh đã hoàn tất.',
        });
    }

    function handleApproveReferences(versionId, decision, feedback = '') {
        const payload = { decision, feedback };
        return runDesignProjectCommand({
            operation: 'reference-approval-' + versionId,
            payload,
            versionId,
            send: (key, options) => approveAIStudioProjectReference(confirmedProjectId, versionId, payload, key, options),
            validateResponse: (response) => isBackendUuid(response?.approvalId)
                && BACKEND_PROJECT_STATUSES.has(response?.projectStatus)
                && ['APPROVED', 'CHANGES_REQUESTED'].includes(response?.versionStatus),
            acceptedMessage: decision === 'APPROVED'
                ? 'Backend đã ghi nhận quyết định duyệt ảnh. Đang cập nhật Pipeline.'
                : 'Backend đã ghi nhận yêu cầu chỉnh sửa. Chọn góc và gửi nội dung chỉnh sửa để tạo revision.',
        });
    }

    function handleGenerateModel(referenceVersionId, revisionFeedback = null) {
        const payload = { referenceVersionId, revisionFeedback };
        const nextVersionNumber = (latestModelVersion?.versionNumber || 0) + 1;
        return runDesignProjectCommand({
            operation: 'models-generate-v' + nextVersionNumber,
            payload,
            versionId: referenceVersionId,
            send: (key, options) => generateAIStudioProjectModel(confirmedProjectId, payload, key, options),
            validateResponse: (response) => isBackendUuid(response?.jobId)
                && isBackendUuid(response?.versionId)
                && response.projectStatus === 'MODEL_QUEUED',
            acceptedVersionField: 'versionId',
            acceptedMessage: 'Backend đã xếp lệnh tạo model. HTTP 202 chưa đồng nghĩa model đã hoàn tất.',
        });
    }

    function handleApproveModel(modelVersionId, decision, feedback = '') {
        const payload = { decision, feedback };
        return runDesignProjectCommand({
            operation: 'model-approval-' + modelVersionId,
            payload,
            versionId: modelVersionId,
            send: (key, options) => approveAIStudioProjectModel(confirmedProjectId, modelVersionId, payload, key, options),
            validateResponse: (response) => isBackendUuid(response?.approvalId)
                && BACKEND_PROJECT_STATUSES.has(response?.projectStatus)
                && ['APPROVED', 'CHANGES_REQUESTED'].includes(response?.versionStatus),
            acceptedMessage: decision === 'APPROVED'
                ? 'Backend đã ghi nhận quyết định duyệt model. Đang cập nhật Pipeline.'
                : 'Backend đã ghi nhận yêu cầu chỉnh sửa model. Bạn có thể gửi revision với nội dung mới.',
        });
    }

    function cancelMutationForSelectedVersion(versionId) {
        const pending = workflowMutationRequestRef.current;
        if (!pending || pending.versionId !== versionId) return;
        pending.controller.abort();
        workflowMutationRequestRef.current = null;
        workflowMutationInFlightRef.current = false;
        setWorkflowCommandState({
            ownerKey: pending.ownerKey,
            projectId: pending.projectId,
            phase: 'uncertain',
            operation: '',
            message: 'Đã dừng chờ phản hồi cho phiên bản cũ. Backend có thể đã nhận lệnh; chỉ thử lại đúng nội dung cũ để dùng lại cùng Idempotency-Key.',
        });
    }

    function handleSelectReferenceVersion(versionId) {
        if (selectedReferenceVersionId && selectedReferenceVersionId !== versionId) cancelMutationForSelectedVersion(selectedReferenceVersionId);
        setSelectedReferenceVersionId(versionId);
    }

    function handleSelectModelVersion(modelVersionId) {
        if (selectedModelVersionId && selectedModelVersionId !== modelVersionId) cancelMutationForSelectedVersion(selectedModelVersionId);
        setSelectedModelVersionId(modelVersionId);
    }

    function requestPrintPreparation() {
        if (!isGenerated || !selectedGeneration) return;
        setPrintDraftError('');
        setPrintProductName(selectedGeneration.title || '');
        setShowPrintNameDialog(true);
    }

    function openPrintPreparation() {
        if (!isGenerated || !selectedGeneration) return;
        const printDraft = createPrintDraftFromGeneration(selectedGeneration, {
            productName: printProductName,
            ...viewerCustomizationToPrintDraftOptions(viewerCustomization),
        });
        if (!printDraft) {
            setPrintDraftError('Chưa thể chuyển sang Print Quote vì phản hồi chưa có model URL và kích thước hợp lệ.');
            return;
        }

        setShowPrintNameDialog(false);
        navigate('/print-quote', {
            state: {
                printDraft: printDraft,
            },
        });
    }

    return (
        <div className="ai-studio-page-shell">
            <AIStudioWorkspace
                inputMode={inputMode}
                setInputMode={(value) => updateProjectInput(setInputMode, value)}
                productType={productType}
                setProductType={(value) => updateProjectInput(setProductType, value)}
                keychainVariant={keychainVariant}
                setKeychainVariant={(value) => updateProjectInput(setKeychainVariant, value)}
                style={style}
                setStyle={(value) => updateProjectInput(setStyle, value)}
                textPrompt={textPrompt}
                setTextPrompt={(value) => updateProjectInput(setTextPrompt, value)}
                uploadedImg={uploadedImg}
                onUploadFile={setUploadedFile}
                clearUploadedFile={clearUploadedFile}
                uploadError={uploadError}
                multiViews={multiViews}
                extraViewSlots={extraViewSlots}
                multiUploadError={multiUploadError}
                isPreparingMulti={pendingMultiHashes > 0}
                onMultiViewFile={handleMultiViewFile}
                onRemoveMultiView={removeMultiView}
                onAddExtraViewSlot={addExtraViewSlot}
                onClearMultiViews={clearMultiViews}
                isGenerated={isGenerated}
                selectedGeneration={selectedGeneration}
                modelViewer={isGenerated && selectedGeneration ? (
                    <div className="ai-studio__model-viewer">
                        <Suspense fallback={
                            <div className="ai-studio__viewer-loading" role="status">
                                <span className="ai-studio__spinner" />
                                <span>Đang mở mô hình 3D…</span>
                            </div>
                        }>
                            <ThreeDViewer
                                stlUrl={selectedGeneration.modelUrl}
                                imgSrc={selectedGeneration.img || null}
                                modelColor="#e2e8f0"
                                dimensions={selectedGeneration.dimensions}
                                partDefinitions={selectedGeneration.parts}
                                onCustomizationChange={handleViewerCustomizationChange}
                                allowDownload={false}
                                onEditModel={({ prompt, imageDataUrl }) => {
                                    updateProjectInput(setInputMode, imageDataUrl ? 'image' : 'text');
                                    updateProjectInput(setTextPrompt, prompt);
                                    releaseUploadedObjectUrl();
                                    setUploadedImg(imageDataUrl);
                                    dispatchGenerationResults({ type: 'reset-preview', ownerKey: generationSessionKey });
                                }}
                            />
                        </Suspense>
                    </div>
                ) : null}
                genError={visibleGenError}
                genStatus={visibleGenStatus}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
                activeJobId={isGenerationPending ? activeJobId : null}
                requestConfirmed={Boolean(activeJobId || selectedGeneration)}
                requestIndeterminate={generationSubmission.status === 'pending' && !activeJobId}
                historyItems={sessionHistory}
                onSelectGeneration={handleSelectGeneration}
                projectHistoryState={visibleProjectHistoryState}
                currentProjectId={projectIdFromUrl}
                onOpenProject={handleOpenProjectSummary}
                onLoadMoreProjects={handleLoadMoreProjects}
                onRetryProjectHistory={() => setProjectHistoryReloadRevision((revision) => revision + 1)}
                onPrintAction={requestPrintPreparation}
                onResetPreview={() => dispatchGenerationResults({ type: 'reset-preview', ownerKey: generationSessionKey })}
                onSaveProject={handleSaveProject}
                canSaveProject={canSaveProject}
                isProjectAuthenticated={isProjectAuthenticated}
                canRetryProject={canRetryProject}
                requiresManualProjectReconciliation={requiresManualProjectReconciliation}
                projectReconciliationMessage={projectReconciliationMessage}
                authLoading={authLoading}
                isSavingProject={isSavingProject}
                isPreparingImage={isPreparingImage}
                projectState={visibleProjectState}
                onReloadProject={() => setProjectReadRevision((revision) => revision + 1)}
                pipelineState={visiblePipelineState}
                onReloadPipeline={() => setPipelineReadRevision((revision) => revision + 1)}
                timelineState={visibleTimelineState}
                onReloadTimeline={() => setTimelineReadRevision((revision) => revision + 1)}
                referenceViewState={visibleReferenceViewState}
                modelArtifactState={visibleModelArtifactState}
                selectedReferenceVersionId={selectedReferenceVersion?.versionId || ''}
                selectedModelVersionId={selectedModelVersion?.modelVersionId || ''}
                onSelectReferenceVersion={handleSelectReferenceVersion}
                onSelectModelVersion={handleSelectModelVersion}
                workflowCommandState={visibleWorkflowCommandState}
                isWorkflowMutationInFlight={workflowMutationInFlightRef.current}
                onGenerateReferences={handleGenerateReferences}
                onApproveReferences={handleApproveReferences}
                onGenerateModel={handleGenerateModel}
                onApproveModel={handleApproveModel}
                designProjectModelViewer={['validated', 'ready'].includes(visibleModelArtifactState.phase) ? (
                    <div className="ai-studio__model-viewer" data-testid="design-project-model-viewer">
                        <Suspense fallback={
                            <div className="ai-studio__viewer-loading" role="status">
                                <span className="ai-studio__spinner" />
                                <span>Đang mở GLB của dự án…</span>
                            </div>
                        }>
                            <ThreeDViewer
                                modelUrl={visibleModelArtifactState.viewerUrl}
                                modelColor="#e2e8f0"
                                presentationMode
                                fixedExportFormat="glb"
                                allowColorCustomization={false}
                                allowDimensionCustomization={false}
                                allowSegmentedCustomization={false}
                                allowDownload={false}
                                preserveOriginalMaterials
                                requireRenderableGLB
                                onModelLoadState={handleDesignModelLoadState}
                            />
                        </Suspense>
                    </div>
                ) : null}
                designProjectPrintReadinessState={visiblePrintReadinessState}
                onRetryPrintReadiness={retryPrintReadiness}
                onOpenDesignProjectPrintPreparation={openDesignProjectPrintPreparation}
            />

            {showPrintNameDialog && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="print-name-title">
                    <form onSubmit={event => { event.preventDefault(); openPrintPreparation(); }} className="w-full max-w-md rounded-xl border border-white/70 bg-white p-6 shadow-2xl">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-light/10 text-brand-primary material-symbols-outlined" aria-hidden="true">sell</span>
                            <div>
                                <h2 id="print-name-title" className="text-lg font-extrabold text-slate-900">Đặt tên sản phẩm in</h2>
                                <p className="mt-1 text-sm leading-relaxed text-slate-500">Đặt tên để nhận biết bản cấu hình khi xem trong Print Quote.</p>
                            </div>
                        </div>
                        <label className="mt-5 block">
                            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Tên sản phẩm</span>
                            <input autoFocus value={printProductName} onChange={event => setPrintProductName(event.target.value)} maxLength="80" placeholder="Ví dụ: Móc khóa cá nhân hóa" className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:font-normal placeholder:text-slate-400 focus:border-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary/30" />
                        </label>
                        {printDraftError && <p className="mt-3 text-sm font-semibold text-rose-600" role="alert">{printDraftError}</p>}
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setShowPrintNameDialog(false)} className="h-10 rounded-lg px-4 text-sm font-bold text-slate-600 hover:bg-slate-100">Quay lại</button>
                            <button type="submit" disabled={!printProductName.trim()} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-primary hover:bg-brand-hover px-5 text-sm font-extrabold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:bg-slate-300"><span className="material-symbols-outlined text-[17px]" aria-hidden="true">arrow_forward</span>Tiếp tục báo giá</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
