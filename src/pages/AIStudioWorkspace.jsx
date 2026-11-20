import { forwardRef, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import {
    editChatSidebarReducer,
    initialEditChatSidebarState,
    MULTI_VIEW_SLOTS,
    getStudioApiInputMode,
    getStudioWorkflowSteps,
    getStylesForProduct,
    getValidStyleForProduct,
    isStudioGenerateActionDisabled,
} from '../features/ai-studio/studioPresentation.js';
import { getNextStudioInputMode } from '../features/ai-studio/inputMode.js';
import { getPipelineJobFailureMessage, getPipelineStatusLabel, hasActivePipelineJobs } from '../features/ai-studio/pipelinePresentation.js';
import { hasCompleteReferenceViewSlots } from '../features/ai-studio/projectWorkflowPresentation.js';
import {
    clampStudioSidebarWidth,
    DEFAULT_STUDIO_SIDEBAR_WIDTH,
    getStudioSidebarBounds,
    getStudioSidebarKeyboardWidth,
    readStudioSidebarWidth,
    writeStudioSidebarWidth,
    readStudioSidebarCollapsed,
    writeStudioSidebarCollapsed,
} from '../features/ai-studio/resizableSidebar.js';

const PRODUCTS = [
    { id: 'keychain', label: 'Móc khóa' },
    { id: 'night-light', label: 'Đèn ngủ' },
    { id: 'figure', label: 'Tượng 3D' },
];

const INPUT_MODES = [
    { id: 'text', label: 'Text to 3D', icon: 'edit_note' },
    { id: 'image', label: 'Image to 3D', icon: 'image' },
    { id: 'multi', label: 'Nhiều góc ảnh', icon: 'collections' },
];

function Icon({ children, className = '' }) {
    return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{children}</span>;
}

const StudioButton = forwardRef(function StudioButton({ children, className = '', ...props }, ref) {
    return <button {...props} ref={ref} className={`ai-studio__button ${className}`}>{children}</button>;
});

function PipelinePanel({
    state,
    onReload,
    timelineState,
    onReloadTimeline,
    referenceViewState,
    modelArtifactState,
    selectedReferenceVersionId,
    selectedModelVersionId,
    onSelectReferenceVersion,
    onSelectModelVersion,
    workflowCommandState,
    isWorkflowMutationInFlight,
    canMutate = false,
    onGenerateReferences,
    onApproveReferences,
    onGenerateModel,
    onApproveModel,
}) {
    const [referenceFeedback, setReferenceFeedback] = useState('');
    const [referenceRevisionFeedback, setReferenceRevisionFeedback] = useState('');
    const [referenceRevisionSlot, setReferenceRevisionSlot] = useState('front');
    const [modelFeedback, setModelFeedback] = useState('');
    const [modelRevisionFeedback, setModelRevisionFeedback] = useState('');
    if (!state || state.phase === 'idle') return null;
    const pipeline = state.pipeline;
    const latestReference = pipeline?.referenceVersions.at(-1);
    const latestModel = pipeline?.modelVersions.at(-1);
    const selectedReference = pipeline?.referenceVersions.find((version) => version.versionId === selectedReferenceVersionId);
    const selectedModel = pipeline?.modelVersions.find((version) => version.modelVersionId === selectedModelVersionId);
    const latestJob = pipeline?.jobs.at(-1);
    const isPipelineConfirmed = ['ready', 'empty'].includes(state.phase);
    const canGenerateReferences = canMutate && isPipelineConfirmed && pipeline
        && (pipeline.projectStatus === 'DRAFT'
            || pipeline.projectStatus === 'FAILED' && latestJob?.stage === 'REFERENCE_IMAGE' && latestJob.status === 'FAILED');
    const canReviseReferences = canMutate && isPipelineConfirmed && pipeline?.projectStatus === 'REFERENCES_REVIEW'
        && latestReference?.status === 'CHANGES_REQUESTED';
    const canApproveReferences = canMutate && isPipelineConfirmed && pipeline?.projectStatus === 'REFERENCES_REVIEW'
        && selectedReference?.versionId === latestReference?.versionId
        && selectedReference?.status === 'READY_FOR_REVIEW'
        && hasCompleteReferenceViewSlots(selectedReference.availableViews)
        && referenceViewState?.versionId === selectedReference.versionId
        && referenceViewState?.phase === 'ready'
        && hasCompleteReferenceViewSlots(referenceViewState.items?.filter((item) => item.phase === 'ready').map((item) => item.slot));
    const canGenerateModel = canMutate && isPipelineConfirmed && pipeline
        && latestReference?.status === 'APPROVED'
        && hasCompleteReferenceViewSlots(latestReference.availableViews)
        && (pipeline.projectStatus === 'REFERENCES_APPROVED'
            || pipeline.projectStatus === 'MODEL_REVIEW' && latestModel?.status === 'CHANGES_REQUESTED'
            || pipeline.projectStatus === 'FAILED' && latestJob?.stage === 'MODEL_MESH'
                && latestJob.status === 'FAILED' && latestModel?.status === 'FAILED');
    const canApproveModel = canMutate && isPipelineConfirmed && pipeline?.projectStatus === 'MODEL_REVIEW'
        && selectedModel?.modelVersionId === latestModel?.modelVersionId
        && selectedModel?.status === 'READY_FOR_REVIEW'
        && selectedModel?.artifactAvailable === true
        && modelArtifactState?.modelVersionId === selectedModel.modelVersionId
        && modelArtifactState?.phase === 'ready';
    const canManuallyContinue = state.phase === 'paused'
        || (state.phase === 'ready' && state.pollingStopped && hasActivePipelineJobs(pipeline));
    const showRetry = state.phase === 'error' || canManuallyContinue;

    return (
        <section className="ai-studio__pipeline" aria-labelledby="studio-pipeline-heading">
            <h4 id="studio-pipeline-heading">Design Pipeline</h4>
            {state.message && state.phase !== 'loading' && <p className={state.phase === 'error' ? 'ai-studio__error' : 'ai-studio__notice'} role={state.phase === 'error' ? 'alert' : 'status'} aria-live="polite">{state.message}</p>}
            {state.phase === 'loading' && <p className="ai-studio__helper" role="status" aria-live="polite">{state.message || 'Đang đọc trạng thái Pipeline từ Backend…'}</p>}
            {state.phase === 'empty' && <p className="ai-studio__notice" role="status">Dự án đã được lưu, nhưng chưa có phiên bản ảnh tham chiếu, model hoặc công việc Pipeline nào được Backend ghi nhận.</p>}
            {state.phase === 'ready' && <p className="sr-only" role="status" aria-live="polite">Đã cập nhật trạng thái Pipeline từ Backend.</p>}
            {pipeline && <div className="ai-studio__pipeline-content">
                {pipeline.referenceVersions.length > 0 && <section className="ai-studio__pipeline-group" aria-label="Reference Versions">
                    <h5>Reference Versions</h5>
                    <ol>
                        {pipeline.referenceVersions.map((version) => <li key={version.versionId}>
                            <strong>Version {version.versionNumber}</strong>
                            <span>{getPipelineStatusLabel(version.status, 'reference')}</span>
                            <span>Available views: {version.availableViews.length ? version.availableViews.join(', ') : '—'}</span>
                            {version.parentVersionId && <span>Parent version: {version.parentVersionId}</span>}
                            <time dateTime={version.createdAt}>{version.createdAt}</time>
                        </li>)}
                    </ol>
                </section>}
                {pipeline.modelVersions.length > 0 && <section className="ai-studio__pipeline-group" aria-label="Model Versions">
                    <h5>Model Versions</h5>
                    <ol>
                        {pipeline.modelVersions.map((version) => <li key={version.modelVersionId}>
                            <strong>Version {version.versionNumber}</strong>
                            <span>{getPipelineStatusLabel(version.status, 'model')}</span>
                            {version.referenceVersionId && <span>Reference version: {version.referenceVersionId}</span>}
                            <span>Artifact: {version.artifactAvailable ? 'Có sẵn' : 'Chưa có'}</span>
                            {version.supersedesModelVersionId && <span>Supersedes model: {version.supersedesModelVersionId}</span>}
                            <time dateTime={version.createdAt}>{version.createdAt}</time>
                        </li>)}
                    </ol>
                </section>}
                {pipeline.jobs.length > 0 && <section className="ai-studio__pipeline-group" aria-label="Pipeline Jobs">
                    <h5>Pipeline Jobs</h5>
                    <ol>
                        {pipeline.jobs.map((job) => <li key={job.jobId}>
                            <strong>{job.stage}</strong>
                            <span>{getPipelineStatusLabel(job.status, 'job')}</span>
                            <span>Attempt: {job.attemptCount}</span>
                            <time dateTime={job.updatedAt}>Updated: {job.updatedAt}</time>
                            {getPipelineJobFailureMessage(job) && <span className="ai-studio__pipeline-safe-error">{getPipelineJobFailureMessage(job)}</span>}
                        </li>)}
                    </ol>
                </section>}
                {state.pollingStopped === 'limit' && <p className="ai-studio__helper" role="status">Đã tạm dừng tự cập nhật sau giới hạn theo dõi. Bạn có thể đọc lại Pipeline thủ công.</p>}
            </div>}
            {showRetry && <StudioButton type="button" className="ai-studio__button--text" onClick={onReload}>
                {state.phase === 'error' ? 'Thử đọc lại' : 'Đọc lại Pipeline'}
            </StudioButton>}
            {workflowCommandState?.message && workflowCommandState.projectId === pipeline?.projectId && <p
                className={['error', 'uncertain', 'blocked'].includes(workflowCommandState.phase) ? 'ai-studio__error' : 'ai-studio__notice'}
                role={['error', 'uncertain', 'blocked'].includes(workflowCommandState.phase) ? 'alert' : 'status'}
                aria-live="polite"
            >{workflowCommandState.message}</p>}
            {pipeline && <section className="ai-studio__workflow-actions" aria-label="Design Project actions">
                <section className="ai-studio__pipeline-group" aria-label="Reference review">
                    <h5>Ảnh tham chiếu</h5>
                    {pipeline.referenceVersions.length > 0 && <label className="ai-studio__workflow-field">
                        <span>Phiên bản ảnh</span>
                        <select aria-label="Phiên bản ảnh tham chiếu" value={selectedReference?.versionId || ''} onChange={event => onSelectReferenceVersion?.(event.target.value)}>
                            {pipeline.referenceVersions.map(version => <option key={version.versionId} value={version.versionId}>Version {version.versionNumber} · {getPipelineStatusLabel(version.status, 'reference')}</option>)}
                        </select>
                    </label>}
                    {referenceViewState?.phase === 'loading' && <p className="ai-studio__helper" role="status">Đang tải ảnh tham chiếu…</p>}
                    {referenceViewState?.message && referenceViewState.phase !== 'loading' && <p className="ai-studio__notice" role="status">{referenceViewState.message}</p>}
                    {referenceViewState?.items?.filter(item => item.phase === 'ready').length > 0 && <div className="ai-studio__reference-views">
                        {referenceViewState.items.filter(item => item.phase === 'ready').map(item => <figure key={item.slot}>
                            <img src={item.url} alt={'Ảnh tham chiếu ' + item.slot} />
                            <figcaption>{item.slot}</figcaption>
                        </figure>)}
                    </div>}
                    {canGenerateReferences && <StudioButton type="button" className="ai-studio__button--primary" disabled={isWorkflowMutationInFlight} onClick={() => onGenerateReferences?.({ viewSlot: null, revisionFeedback: null })}>
                        {pipeline.projectStatus === 'FAILED' ? 'Thử lại tạo ảnh tham chiếu' : 'Tạo ảnh tham chiếu'}
                    </StudioButton>}
                    {canApproveReferences && <div className="ai-studio__workflow-form">
                        <label className="ai-studio__workflow-field"><span>Phản hồi duyệt ảnh (không bắt buộc)</span><textarea maxLength={2000} value={referenceFeedback} onChange={event => setReferenceFeedback(event.target.value)} /></label>
                        <div className="ai-studio__workflow-buttons">
                            <StudioButton type="button" className="ai-studio__button--primary" disabled={isWorkflowMutationInFlight} onClick={() => onApproveReferences?.(selectedReference.versionId, 'APPROVED', referenceFeedback)}>Duyệt ảnh tham chiếu</StudioButton>
                            <StudioButton type="button" className="ai-studio__button--secondary" disabled={isWorkflowMutationInFlight || !referenceFeedback.trim()} onClick={() => onApproveReferences?.(selectedReference.versionId, 'CHANGES_REQUESTED', referenceFeedback)}>Yêu cầu chỉnh sửa</StudioButton>
                        </div>
                    </div>}
                    {canReviseReferences && <div className="ai-studio__workflow-form">
                        <label className="ai-studio__workflow-field"><span>Góc cần tạo lại</span>
                            <select aria-label="Góc cần chỉnh sửa" value={referenceRevisionSlot} onChange={event => setReferenceRevisionSlot(event.target.value)}>
                                {['front', 'left', 'right', 'back'].map(slot => <option key={slot} value={slot}>{slot}</option>)}
                            </select>
                        </label>
                        <label className="ai-studio__workflow-field"><span>Nội dung chỉnh sửa</span><textarea maxLength={2000} value={referenceRevisionFeedback} onChange={event => setReferenceRevisionFeedback(event.target.value)} /></label>
                        <StudioButton type="button" className="ai-studio__button--primary" disabled={isWorkflowMutationInFlight || !referenceRevisionFeedback.trim()} onClick={() => onGenerateReferences?.({ viewSlot: referenceRevisionSlot, revisionFeedback: referenceRevisionFeedback.trim() })}>Tạo revision ảnh</StudioButton>
                    </div>}
                </section>
                <section className="ai-studio__pipeline-group" aria-label="Model review">
                    <h5>Model 3D</h5>
                    {pipeline.modelVersions.length > 0 && <label className="ai-studio__workflow-field">
                        <span>Phiên bản model</span>
                        <select aria-label="Phiên bản model" value={selectedModel?.modelVersionId || ''} onChange={event => onSelectModelVersion?.(event.target.value)}>
                            {pipeline.modelVersions.map(version => <option key={version.modelVersionId} value={version.modelVersionId}>Version {version.versionNumber} · {getPipelineStatusLabel(version.status, 'model')}</option>)}
                        </select>
                    </label>}
                    {['loading', 'validated'].includes(modelArtifactState?.phase) && <p className="ai-studio__helper" role="status">{modelArtifactState.message}</p>}
                    {['error', 'invalid'].includes(modelArtifactState?.phase) && <p className="ai-studio__error" role="alert">{modelArtifactState.message}</p>}
                    {canGenerateModel && <div className="ai-studio__workflow-form">
                        {latestModel?.status === 'CHANGES_REQUESTED' && <label className="ai-studio__workflow-field"><span>Nội dung chỉnh sửa model</span><textarea maxLength={2000} value={modelRevisionFeedback} onChange={event => setModelRevisionFeedback(event.target.value)} /></label>}
                        <StudioButton type="button" className="ai-studio__button--primary" disabled={isWorkflowMutationInFlight || latestModel?.status === 'CHANGES_REQUESTED' && !modelRevisionFeedback.trim()} onClick={() => onGenerateModel?.(latestReference.versionId, modelRevisionFeedback.trim() || null)}>
                            {pipeline.projectStatus === 'FAILED' ? 'Thử lại tạo model' : latestModel?.status === 'CHANGES_REQUESTED' ? 'Tạo revision model' : 'Tạo model 3D'}
                        </StudioButton>
                    </div>}
                    {canApproveModel && <div className="ai-studio__workflow-form">
                        <label className="ai-studio__workflow-field"><span>Phản hồi duyệt model (không bắt buộc)</span><textarea maxLength={2000} value={modelFeedback} onChange={event => setModelFeedback(event.target.value)} /></label>
                        <div className="ai-studio__workflow-buttons">
                            <StudioButton type="button" className="ai-studio__button--primary" disabled={isWorkflowMutationInFlight} onClick={() => onApproveModel?.(selectedModel.modelVersionId, 'APPROVED', modelFeedback)}>Duyệt model</StudioButton>
                            <StudioButton type="button" className="ai-studio__button--secondary" disabled={isWorkflowMutationInFlight || !modelFeedback.trim()} onClick={() => onApproveModel?.(selectedModel.modelVersionId, 'CHANGES_REQUESTED', modelFeedback)}>Yêu cầu chỉnh sửa</StudioButton>
                        </div>
                    </div>}
                    {modelArtifactState?.phase === 'ready' && <p className="ai-studio__notice" role="status">Artifact GLB đã parse, có mesh hình học hợp lệ và tải thành công trong Viewer.</p>}
                </section>
                <section className="ai-studio__pipeline-group" aria-label="Project Timeline">
                    <h5>Timeline & phiên bản</h5>
                    {timelineState?.phase === 'loading' && <p className="ai-studio__helper" role="status">{timelineState.message}</p>}
                    {['error', 'invalid'].includes(timelineState?.phase) && <div className="ai-studio__history-error">
                        <p className="ai-studio__error" role="alert">{timelineState.message}</p>
                        <StudioButton type="button" className="ai-studio__button--text" onClick={onReloadTimeline}>Đọc lại Timeline</StudioButton>
                    </div>}
                    {timelineState?.phase === 'ready' && timelineState.timeline.events.length === 0 && <p className="ai-studio__helper">Backend chưa ghi nhận sự kiện Timeline.</p>}
                    {timelineState?.phase === 'ready' && timelineState.timeline.events.length > 0 && <ol className="ai-studio__timeline">
                        {timelineState.timeline.events.map(event => <li key={event.recordType + '-' + event.eventId}>
                            <strong>{event.eventType.replaceAll('_', ' ')}</strong>
                            {event.status && <span>{event.status}</span>}
                            {event.decision && <span>{event.decision}</span>}
                            {event.versionId && <small>Version: {event.versionId}</small>}
                            {event.parentId && <small>Parent: {event.parentId}</small>}
                            {event.supersedesId && <small>Supersedes: {event.supersedesId}</small>}
                            {event.viewSlot && <small>View: {event.viewSlot}</small>}
                            {event.stage && <small>{event.stage} · lần thử {event.attemptCount}</small>}
                            {event.safeErrorCode && <small className="ai-studio__pipeline-safe-error">Mã lỗi: {event.safeErrorCode}</small>}
                            {event.feedback && <p>{event.feedback}</p>}
                            <time dateTime={event.occurredAt}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurredAt))}</time>
                        </li>)}
                    </ol>}
                </section>
            </section>}
        </section>
    );
}

function ProjectDetailsPanel({
    projectState,
    onReloadProject,
    pipelineState,
    onReloadPipeline,
    timelineState,
    onReloadTimeline,
    referenceViewState,
    modelArtifactState,
    selectedReferenceVersionId,
    selectedModelVersionId,
    onSelectReferenceVersion,
    onSelectModelVersion,
    workflowCommandState,
    isWorkflowMutationInFlight,
    canMutate,
    onGenerateReferences,
    onApproveReferences,
    onGenerateModel,
    onApproveModel,
}) {
    if (projectState?.phase !== 'loaded' || !projectState.project) return null;
    const project = projectState.project;

    return <div className="ai-studio__history-project-details" aria-label="Chi tiết dự án đang mở">
        <dl className="ai-studio__project-details">
            <div><dt>Project ID</dt><dd>{project.projectId}</dd></div>
            <div><dt>Sản phẩm</dt><dd>{project.productType}</dd></div>
            <div><dt>Phong cách</dt><dd>{project.styleId}</dd></div>
            <div><dt>Chế độ nhập</dt><dd>{project.inputMode}</dd></div>
            {typeof project.originalIdea === 'string' && <div><dt>Ý tưởng đã lưu</dt><dd>{project.originalIdea}</dd></div>}
            {Array.isArray(project.clientSlots) && <div><dt>Góc ảnh đã lưu</dt><dd>{project.clientSlots.join(', ')}</dd></div>}
            {Array.isArray(project.viewHints) && <div><dt>View hints</dt><dd>{project.viewHints.map((hint) => hint || '—').join(', ')}</dd></div>}
        </dl>
        {project.inputMode === 'image' && !projectState.sourceImageAvailable && !projectState.sourceRestoreMessage && <p className="ai-studio__helper" role="status">Backend chưa trả về nội dung ảnh nguồn có thể khôi phục cho dự án này.</p>}
        {project.inputMode === 'multi' && !projectState.sourceMultiFilesAvailable && !projectState.sourceRestoreMessage && <p className="ai-studio__helper" role="status">Backend chưa trả về đủ nội dung ảnh nguồn để khôi phục dự án MULTI.</p>}
        {projectState.sourceRestoreMessage && <><p className="ai-studio__notice" role="status">{projectState.sourceRestoreMessage}</p><StudioButton type="button" className="ai-studio__button--text" onClick={onReloadProject}>Đọc lại dự án</StudioButton></>}
        <PipelinePanel
            state={pipelineState}
            onReload={onReloadPipeline}
            timelineState={timelineState}
            onReloadTimeline={onReloadTimeline}
            referenceViewState={referenceViewState}
            modelArtifactState={modelArtifactState}
            selectedReferenceVersionId={selectedReferenceVersionId}
            selectedModelVersionId={selectedModelVersionId}
            onSelectReferenceVersion={onSelectReferenceVersion}
            onSelectModelVersion={onSelectModelVersion}
            workflowCommandState={workflowCommandState}
            isWorkflowMutationInFlight={isWorkflowMutationInFlight}
            canMutate={canMutate}
            onGenerateReferences={onGenerateReferences}
            onApproveReferences={onApproveReferences}
            onGenerateModel={onGenerateModel}
            onApproveModel={onApproveModel}
        />
    </div>;
}

export default function AIStudioWorkspace({
    inputMode,
    setInputMode,
    productType,
    setProductType,
    keychainVariant,
    setKeychainVariant,
    style,
    setStyle,
    textPrompt,
    setTextPrompt,
    uploadedImg,
    onUploadFile,
    clearUploadedFile,
    uploadError,
    multiViews = {},
    extraViewSlots = [],
    multiUploadError = '',
    isPreparingMulti = false,
    onMultiViewFile,
    onRemoveMultiView,
    onAddExtraViewSlot,
    onClearMultiViews,
    isGenerated,
    selectedGeneration,
    modelViewer,
    genError,
    genStatus,
    onGenerate,
    isGenerating = false,
    activeJobId = null,
    requestIndeterminate = false,
    requestConfirmed = false,
    historyItems,
    onSelectGeneration,
    projectHistoryState = { phase: 'idle', items: [], page: -1, last: true },
    currentProjectId = '',
    onOpenProject,
    onLoadMoreProjects,
    onRetryProjectHistory,
    onPrintAction,
    onResetPreview,
    onSaveProject,
    canSaveProject = false,
    isProjectAuthenticated = false,
    canRetryProject = false,
    requiresManualProjectReconciliation = false,
    projectReconciliationMessage = '',
    authLoading = false,
    isSavingProject = false,
    isPreparingImage = false,
    projectState,
    onReloadProject,
    pipelineState,
    onReloadPipeline,
    timelineState,
    onReloadTimeline,
    referenceViewState,
    modelArtifactState,
    selectedReferenceVersionId = '',
    selectedModelVersionId = '',
    onSelectReferenceVersion,
    onSelectModelVersion,
    workflowCommandState,
    isWorkflowMutationInFlight = false,
    onGenerateReferences,
    onApproveReferences,
    onGenerateModel,
    onApproveModel,
    designProjectModelViewer,
    designProjectPrintReadinessState = { phase: 'idle', modelVersionId: '', data: null, message: '' },
    onRetryPrintReadiness,
    onOpenDesignProjectPrintPreparation,
}) {
    const singleFileRef = useRef(null);
    const multiFileRefs = useRef({});
    const mobileDrawerToggleRef = useRef(null);
    const mobileDrawerCloseRef = useRef(null);
    const imageDescriptionTextareaRef = useRef(null);
    const inputPanelRef = useRef(null);
    const workspaceRef = useRef(null);
    const sidebarRef = useRef(null);
    const resizeHandleRef = useRef(null);
    const resizeStartRef = useRef(null);
    const sidebarWidthRef = useRef(DEFAULT_STUDIO_SIDEBAR_WIDTH);
    const [sidebarWidth, setSidebarWidth] = useState(() => {
        try {
            return readStudioSidebarWidth(window.localStorage);
        } catch {
            return DEFAULT_STUDIO_SIDEBAR_WIDTH;
        }
    });
    const [workspaceMetrics, setWorkspaceMetrics] = useState({ width: 0, dividerWidth: 16, historyWidth: 250 });
    const effectiveSidebarWidth = workspaceMetrics.width > 0
        ? clampStudioSidebarWidth(sidebarWidth, workspaceMetrics.width, workspaceMetrics.dividerWidth, workspaceMetrics.historyWidth)
        : sidebarWidth;
    const [isSidebarResizing, setIsSidebarResizing] = useState(false);
    const [workspacePanelState, dispatchWorkspacePanel] = useReducer(
        editChatSidebarReducer,
        initialEditChatSidebarState,
        initialState => ({ ...initialState, isPanelCollapsed: readStudioSidebarCollapsed(window.localStorage) }),
    );
    const {
        isPanelCollapsed: panelCollapsed,
        isMobileDrawerOpen,
        isChatOpen,
    } = workspacePanelState;
    const [isCompactLayout, setIsCompactLayout] = useState(() => (
        typeof window !== 'undefined' && window.matchMedia('(max-width: 960px)').matches
    ));
    const [selectedMultiView, setSelectedMultiView] = useState('front');
    const [isImageExpanded, setIsImageExpanded] = useState(false);
    const [chatMode, setChatMode] = useState('direct-3d');
    const [chatPrompt, setChatPrompt] = useState('');
    const [chatNotice, setChatNotice] = useState('');
    const [chatAttachment, setChatAttachment] = useState(null);
    const [imageZoom, setImageZoom] = useState(1);

    useEffect(() => {
        sidebarWidthRef.current = sidebarWidth;
    }, [sidebarWidth]);

    useEffect(() => {
        writeStudioSidebarCollapsed(window.localStorage, panelCollapsed);
    }, [panelCollapsed]);

    useLayoutEffect(() => {
        if (inputMode !== 'image') return;
        const textarea = imageDescriptionTextareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }, [inputMode, textPrompt]);

    useLayoutEffect(() => {
        if (!workspaceRef.current) return undefined;

        const measureWorkspace = () => {
            const element = workspaceRef.current;
            if (!element) return;
            const width = element.getBoundingClientRect().width;
            const computedStyle = window.getComputedStyle(element);
            const configuredDividerWidth = Number.parseFloat(computedStyle.getPropertyValue('--studio-divider-width'));
            const measuredDividerWidth = resizeHandleRef.current?.getBoundingClientRect().width;
            const dividerWidth = measuredDividerWidth > 0 ? measuredDividerWidth
                : Number.isFinite(configuredDividerWidth) && configuredDividerWidth > 0 ? configuredDividerWidth : 16;
            const configuredHistoryMinWidth = Number.parseFloat(computedStyle.getPropertyValue('--studio-history-min-width'));
            const historyPanel = element.querySelector('.ai-studio__history-panel');
            const measuredHistoryWidth = historyPanel?.getBoundingClientRect().width;
            const historyWidth = measuredHistoryWidth > 0 ? measuredHistoryWidth
                : Number.isFinite(configuredHistoryMinWidth) && configuredHistoryMinWidth > 0
                ? configuredHistoryMinWidth : 250;
            setWorkspaceMetrics(current => current.width === width
                && current.dividerWidth === dividerWidth
                && current.historyWidth === historyWidth
                ? current : { width, dividerWidth, historyWidth });
        };

        measureWorkspace();
        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(measureWorkspace);
            observer.observe(workspaceRef.current);
            const historyPanel = workspaceRef.current.querySelector('.ai-studio__history-panel');
            if (historyPanel) observer.observe(historyPanel);
            return () => observer.disconnect();
        }

        window.addEventListener('resize', measureWorkspace);
        return () => window.removeEventListener('resize', measureWorkspace);
    }, [isCompactLayout, panelCollapsed]);

    useEffect(() => {
        const media = window.matchMedia('(max-width: 960px)');
        const handleChange = event => {
            setIsCompactLayout(event.matches);
            dispatchWorkspacePanel({ type: 'mobile-close' });
        };
        setIsCompactLayout(media.matches);
        media.addEventListener('change', handleChange);
        return () => media.removeEventListener('change', handleChange);
    }, []);

    const availableStyles = getStylesForProduct(productType, keychainVariant);
    const validApiMode = getStudioApiInputMode(inputMode);
    const hasSelection = Boolean(productType && availableStyles.some(option => option.id === style));
    const workflowSteps = getStudioWorkflowSteps({
        projectState,
        pipelineState,
    });
    const isShowingDesignProjectModel = Boolean(designProjectModelViewer);
    const canOpenDesignProjectPrintPreparation = isShowingDesignProjectModel
        && modelArtifactState?.phase === 'ready'
        && designProjectPrintReadinessState?.phase === 'ready'
        && designProjectPrintReadinessState.modelVersionId === modelArtifactState.modelVersionId
        && designProjectPrintReadinessState.data?.readiness === 'READY'
        && designProjectPrintReadinessState.data?.modelVersionId === modelArtifactState.modelVersionId
        && designProjectPrintReadinessState.data?.artifactSha256 === modelArtifactState.sha256;
    const viewSlots = [...MULTI_VIEW_SLOTS, ...extraViewSlots];
    const currentMultiImage = multiViews[selectedMultiView];
    const previewImage = inputMode === 'multi' ? currentMultiImage?.url : uploadedImg;

    useEffect(() => {
        if (!isCompactLayout || !isMobileDrawerOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        mobileDrawerCloseRef.current?.focus();

        function handleDrawerKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                dispatchWorkspacePanel({ type: 'mobile-close' });
                return;
            }
            if (event.key !== 'Tab' || !inputPanelRef.current) return;

            const focusable = [...inputPanelRef.current.querySelectorAll(
                'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
            )].filter(element => !element.closest('[inert]') && element.getClientRects().length > 0);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || !inputPanelRef.current.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (document.activeElement === last || !inputPanelRef.current.contains(document.activeElement))) {
                event.preventDefault();
                first.focus();
            }
        }

        window.addEventListener('keydown', handleDrawerKeyDown);
        return () => {
            window.removeEventListener('keydown', handleDrawerKeyDown);
            document.body.style.overflow = previousOverflow;
            if (window.matchMedia('(max-width: 960px)').matches && mobileDrawerToggleRef.current?.isConnected) {
                mobileDrawerToggleRef.current.focus();
            }
        };
    }, [isCompactLayout, isMobileDrawerOpen]);

    useEffect(() => {
        if (!isImageExpanded) return undefined;
        function closeExpandedImage(event) {
            if (event.key === 'Escape') setIsImageExpanded(false);
        }
        window.addEventListener('keydown', closeExpandedImage);
        return () => window.removeEventListener('keydown', closeExpandedImage);
    }, [isImageExpanded]);

    function chooseProduct(nextProduct) {
        const selectedProduct = productType === nextProduct ? null : nextProduct;
        const nextVariant = selectedProduct === 'keychain' && productType === 'keychain'
            ? keychainVariant : 'ordinary';
        setProductType(selectedProduct);
        setKeychainVariant(nextVariant);
        setStyle(getValidStyleForProduct(selectedProduct, nextVariant, ''));
    }

    function chooseKeychainVariant(nextVariant) {
        setKeychainVariant(nextVariant);
        setStyle(getValidStyleForProduct(productType, nextVariant, style));
    }

    function chooseInputMode(mode) {
        setInputMode(mode);
        setChatNotice('');
    }

    function handleInputModeKeyDown(event, modeId) {
        const modes = INPUT_MODES.map(mode => mode.id);
        const nextMode = getNextStudioInputMode(modeId, event.key, modes);
        if (!nextMode) return;

        event.preventDefault();
        chooseInputMode(nextMode);
        const nextIndex = modes.indexOf(nextMode);
        event.currentTarget.parentElement?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
    }

    function removeMultiView(slotId) {
        if (selectedMultiView === slotId) {
            const remaining = viewSlots.find(slot => slot.id !== slotId && multiViews[slot.id]);
            setSelectedMultiView(remaining?.id || 'front');
        }
        onRemoveMultiView?.(slotId);
    }

    function openEditChat(mode = 'direct-3d') {
        dispatchWorkspacePanel({ type: 'open-chat' });
        setChatMode(mode);
    }

    function closeEditChat() {
        dispatchWorkspacePanel({ type: 'close-chat' });
    }

    function resetStudioSelections() {
        onClearMultiViews?.();
        setSelectedMultiView('front');
        setProductType(null);
        setStyle('');
        setKeychainVariant('ordinary');
        dispatchWorkspacePanel({ type: 'reset' });
        setInputMode('text');
        setTextPrompt('');
        clearUploadedFile();
        setIsImageExpanded(false);
        setImageZoom(1);
        setChatPrompt('');
        setChatAttachment(null);
        setChatNotice('');
        onResetPreview?.();
    }

    function submitEditRequest(event) {
        event.preventDefault();
        setChatNotice('Tính năng chỉnh sửa chưa khả dụng. Yêu cầu này chưa được gửi và mô hình chưa thay đổi.');
    }

    function applySidebarWidth(requestedWidth, persist = false) {
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || workspaceMetrics.width;
        if (workspaceWidth <= 0) return;
        const nextWidth = clampStudioSidebarWidth(requestedWidth, workspaceWidth, workspaceMetrics.dividerWidth, workspaceMetrics.historyWidth);
        sidebarWidthRef.current = nextWidth;
        setSidebarWidth(nextWidth);
        if (persist) {
            try {
                writeStudioSidebarWidth(window.localStorage, nextWidth);
            } catch {
                // Resizing remains available when browser storage is disabled.
            }
        }
    }

    function startSidebarResize(event) {
        if (isCompactLayout || panelCollapsed || event.button !== 0) return;
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || workspaceMetrics.width;
        const currentWidth = sidebarRef.current?.getBoundingClientRect().width || effectiveSidebarWidth;
        if (workspaceWidth <= 0) return;
        event.preventDefault();
        resizeStartRef.current = { pointerId: event.pointerId, x: event.clientX, width: currentWidth };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setIsSidebarResizing(true);
    }

    function moveSidebarResize(event) {
        const start = resizeStartRef.current;
        if (!start || start.pointerId !== event.pointerId) return;
        applySidebarWidth(start.width + event.clientX - start.x);
    }

    function finishSidebarResize(event) {
        const start = resizeStartRef.current;
        if (!start || (event?.pointerId !== undefined && start.pointerId !== event.pointerId)) return;
        resizeStartRef.current = null;
        setIsSidebarResizing(false);
        try {
            writeStudioSidebarWidth(window.localStorage, sidebarWidthRef.current);
        } catch {
            // Resizing remains available when browser storage is disabled.
        }
        if (event?.currentTarget?.hasPointerCapture?.(start.pointerId)) {
            event.currentTarget.releasePointerCapture(start.pointerId);
        }
    }

    function handleSidebarResizeKeyDown(event) {
        const { min, max } = getStudioSidebarBounds(workspaceMetrics.width, workspaceMetrics.dividerWidth, workspaceMetrics.historyWidth);
        const nextWidth = getStudioSidebarKeyboardWidth(effectiveSidebarWidth, event.key, { min, max });
        if (nextWidth === null) return;
        event.preventDefault();
        applySidebarWidth(nextWidth, true);
    }

    const inputReady = hasSelection && (
        inputMode === 'text' ? Boolean(textPrompt.trim())
            : inputMode === 'image' ? Boolean(uploadedImg)
                : viewSlots.some(slot => multiViews[slot.id])
    );
    const generateActionDisabled = isStudioGenerateActionDisabled({
        inputMode,
        inputReady,
        isGenerating,
        activeJobId,
        requestIndeterminate,
    });

    return (
        <div className={`ai-studio-page ${panelCollapsed ? 'ai-studio-page--panel-collapsed' : ''} ${isCompactLayout ? 'ai-studio-page--compact' : ''} ${isMobileDrawerOpen ? 'ai-studio-page--drawer-open' : ''}`}>
            <div className="ai-studio__container">
                <header className="ai-studio__studio-bar">
                    <div className="ai-studio__studio-heading"><span className="ai-studio__brand-mark"><Icon>view_in_ar</Icon></span><div><p className="ai-studio__eyebrow">Pocket Joy</p><h1>AI Studio</h1></div></div>
                    <ol className="ai-studio__stepper" aria-label="Tiến trình AI Studio">
                        {workflowSteps.map((step, index) => <li
                            key={step.label}
                            className={`is-${step.status}`}
                            aria-current={step.status === 'current' ? 'step' : undefined}
                            aria-disabled={step.status === 'unavailable' ? 'true' : undefined}
                        ><span>{index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div></li>)}
                    </ol>
                </header>
                <div
                    ref={workspaceRef}
                    className={`ai-studio__workspace ${isSidebarResizing ? 'is-resizing' : ''}`}
                    style={{ '--studio-sidebar-width': `${effectiveSidebarWidth}px` }}
                >
                    {isCompactLayout && isMobileDrawerOpen && <button
                        type="button"
                        className="ai-studio__drawer-backdrop"
                        aria-label="Đóng bảng ý tưởng"
                        onClick={() => dispatchWorkspacePanel({ type: 'mobile-close' })}
                    />}
                    <aside ref={sidebarRef} className={`ai-studio__sidebar ${panelCollapsed ? 'is-collapsed' : ''} ${isMobileDrawerOpen ? 'is-mobile-open' : ''}`} aria-label="Công cụ tạo mô hình">
                        <div className="ai-studio__sidebar-rail">
                            <StudioButton
                                type="button"
                                className="ai-studio__icon-button"
                                title="Mở bảng ý tưởng"
                                aria-label="Mở bảng ý tưởng"
                                aria-expanded="false"
                                aria-controls="studio-input-panel"
                                onClick={() => dispatchWorkspacePanel({ type: 'toggle-panel' })}
                            ><Icon>left_panel_open</Icon></StudioButton>
                        </div>
                        <section
                            ref={inputPanelRef}
                            id="studio-input-panel"
                            className="ai-studio__input-panel"
                            aria-label="Bảng tạo mô hình"
                            aria-hidden={isCompactLayout ? !isMobileDrawerOpen : panelCollapsed}
                            inert={(isCompactLayout ? !isMobileDrawerOpen : panelCollapsed) ? '' : undefined}
                        >
                            <div className="ai-studio__panel-heading">
                                <div>
                                    <p className="ai-studio__eyebrow">Bắt đầu sáng tạo</p>
                                    <h2>Ý tưởng của bạn</h2>
                                </div>
                                <div className="ai-studio__panel-controls">
                                    <StudioButton type="button" className="ai-studio__icon-button ai-studio__reset-button" onClick={resetStudioSelections} title="Làm mới lựa chọn" aria-label="Làm mới lựa chọn">
                                        <Icon>refresh</Icon>
                                    </StudioButton>
                                    <StudioButton ref={mobileDrawerCloseRef} type="button" className="ai-studio__icon-button ai-studio__mobile-close" onClick={() => dispatchWorkspacePanel({ type: 'mobile-close' })} title="Đóng bảng ý tưởng" aria-label="Đóng bảng ý tưởng">
                                        <Icon>close</Icon>
                                    </StudioButton>
                                    <StudioButton type="button" className="ai-studio__icon-button ai-studio__desktop-collapse" onClick={() => dispatchWorkspacePanel({ type: 'toggle-panel' })} title="Thu gọn bảng ý tưởng" aria-label="Thu gọn bảng ý tưởng" aria-expanded="true" aria-controls="studio-input-panel">
                                        <Icon>left_panel_close</Icon>
                                    </StudioButton>
                                </div>
                            </div>

                            <div className="ai-studio__input-block">
                                <div className="ai-studio__mode-tabs" role="tablist" aria-label="Generation input mode">
                                    {INPUT_MODES.map(mode => <button key={mode.id} type="button" role="tab" tabIndex={inputMode === mode.id ? 0 : -1} aria-selected={inputMode === mode.id} onKeyDown={event => handleInputModeKeyDown(event, mode.id)} onClick={() => chooseInputMode(mode.id)}>
                                        <Icon>{mode.icon}</Icon><span>{mode.label}</span>
                                    </button>)}
                                </div>
                            </div>

                            <section className="ai-studio__description-card" aria-labelledby="studio-description-heading">
                                <h3 id="studio-description-heading"><Icon>{inputMode === 'text' ? 'edit_note' : 'image'}</Icon>{inputMode === 'multi' ? 'MULTI-VIEW REFERENCES' : inputMode === 'text' ? 'DESCRIBE YOUR MODEL' : 'IMAGE REFERENCE'}</h3>
                                {inputMode === 'text' && <label className="ai-studio__input-block">
                                    <span className="sr-only">Describe your model</span>
                                    <textarea value={textPrompt} onChange={event => setTextPrompt(event.target.value.slice(0, 4000))} maxLength={4000} placeholder="Describe the 3D model you want to create… e.g. 'A futuristic hexagonal desk organizer with rounded edges and a honeycomb pattern'" rows={8} />
                                    <span className="ai-studio__helper">{textPrompt.length}/4000 ký tự</span>
                                </label>}

                                {inputMode === 'image' && <div className="ai-studio__input-block">
                                    <input ref={singleFileRef} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={event => { onUploadFile(event.target.files?.[0]); event.target.value = ''; }} hidden aria-label="Choose a PNG, JPEG or WebP reference image" />
                                    <button type="button" className="ai-studio__upload-zone" onClick={() => singleFileRef.current?.click()}>
                                        <Icon>{uploadedImg ? 'photo_camera' : 'add_photo_alternate'}</Icon>
                                        <span>{uploadedImg ? 'Choose another image' : 'Upload one image'}</span>
                                        <small>Choose an image from your device</small>
                                    </button>
                                    {uploadError && <p className="ai-studio__error" role="alert">{uploadError}</p>}
                                    {uploadedImg && <StudioButton type="button" className="ai-studio__button--text" onClick={clearUploadedFile}>Remove selected image</StudioButton>}
                                    <label className="ai-studio__input-block">
                                        <span>Mô tả bổ sung (không bắt buộc)</span>
                                        <textarea ref={imageDescriptionTextareaRef} data-autosize="true" value={textPrompt} onChange={event => setTextPrompt(event.target.value.slice(0, 4000))} maxLength={4000} placeholder="Thêm mô tả cho ảnh (tối đa 4.000 ký tự)" rows={3} />
                                        <span className="ai-studio__helper">{textPrompt.length}/4000 ký tự</span>
                                    </label>
                                </div>}

                                {inputMode === 'multi' && <div className="ai-studio__input-block">
                                    <p className="ai-studio__helper">Tải lên từ 2 đến 8 ảnh PNG, JPEG hoặc WebP (tối đa 10 MiB mỗi ảnh). Có thể chọn các góc front, left, right, back và thêm tối đa 4 góc bổ sung.</p>
                                    <p className="ai-studio__helper">Đã chọn {Object.keys(multiViews).length}/8 ảnh.{isPreparingMulti ? ' Đang chuẩn bị nội dung ảnh…' : ''}</p>
                                    <div className="ai-studio__view-slots">
                                        {viewSlots.map(slot => <div className="ai-studio__view-slot" key={slot.id}>
                                            <input ref={node => { multiFileRefs.current[slot.id] = node; }} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" disabled={isSavingProject} hidden aria-label={`Choose ${slot.label} view`} onChange={event => { onMultiViewFile?.(slot.id, event.target.files?.[0]); setSelectedMultiView(slot.id); event.target.value = ''; }} />
                                            <button type="button" disabled={isSavingProject} aria-pressed={Boolean(multiViews[slot.id])} onClick={() => multiFileRefs.current[slot.id]?.click()}>
                                                {multiViews[slot.id] ? <img src={multiViews[slot.id].url} alt={`${slot.label} view`} /> : <Icon>add</Icon>}
                                                <span>{slot.label}</span>
                                            </button>
                                            {multiViews[slot.id] && <StudioButton type="button" className="ai-studio__button--text" disabled={isSavingProject} onClick={() => removeMultiView(slot.id)}>Remove</StudioButton>}
                                        </div>)}
                                    </div>
                                    <StudioButton type="button" className="ai-studio__button--text" disabled={extraViewSlots.length >= 4 || isSavingProject} onClick={onAddExtraViewSlot}><Icon>add</Icon>Add another view</StudioButton>
                                    {multiUploadError && <p className="ai-studio__error" role="alert">{multiUploadError}</p>}
                                </div>}
                            </section>

                            <fieldset className="ai-studio__choice-group">
                                <legend>Chọn sản phẩm</legend>
                                <div className="ai-studio__product-options">
                                    {PRODUCTS.map(product => (
                                        <button key={product.id} type="button" aria-pressed={productType === product.id} onClick={() => chooseProduct(product.id)} className={`ai-studio__choice ${productType === product.id ? 'is-selected' : ''}`}>
                                            {product.label}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>

                            {productType === 'keychain' && <fieldset className="ai-studio__choice-group">
                                <legend>Loại móc khóa</legend>
                                <div className="ai-studio__design-options" role="group" aria-label="Loại móc khóa">
                                    {[['ordinary', 'Thường'], ['click', 'Click']].map(([value, label]) => <button key={value} type="button" aria-pressed={keychainVariant === value} onClick={() => chooseKeychainVariant(value)} className={`ai-studio__choice ${keychainVariant === value ? 'is-selected' : ''}`}>{label}</button>)}
                                </div>
                                <p className="ai-studio__helper">Loại móc khóa được lưu cùng Design Project; generation cũ chưa nhận trường này.</p>
                            </fieldset>}

                            {hasSelection && <section className="ai-studio__settings-card" aria-labelledby="studio-settings-heading">
                                <h3 id="studio-settings-heading"><Icon>tune</Icon>Generation Settings</h3>
                                <label className="ai-studio__style-field">
                                    <span>PHONG CÁCH</span>
                                    <select aria-label="Phong cách theo sản phẩm" value={style} onChange={event => setStyle(event.target.value)}>
                                        {availableStyles.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                                    </select>
                                </label>
                                <p className="ai-studio__settings-note">Lưu dự án gửi Product Type{productType === 'keychain' ? ' cùng Keychain Variant' : ''} và Style ID.</p>
                            </section>}

                            <div className="ai-studio__submit-block">
                                <p className="ai-studio__helper">Lưu dự án sẽ lưu ý tưởng và lựa chọn vào Backend; thao tác này chưa tạo ảnh tham chiếu hoặc model 3D.</p>
                                {['text', 'image', 'multi'].includes(inputMode) ? <StudioButton
                                    type="button"
                                    className="ai-studio__button--secondary"
                                    disabled={!canSaveProject || isSavingProject || isPreparingImage || isPreparingMulti}
                                    aria-busy={isSavingProject}
                                    onClick={onSaveProject}
                                >
                                    <Icon>save</Icon>{isPreparingImage || isPreparingMulti ? 'Đang chuẩn bị ảnh…' : isSavingProject ? 'Đang lưu dự án…' : canRetryProject ? 'Gửi lại an toàn' : 'Lưu dự án'}
                                </StudioButton> : <p className="ai-studio__notice" role="status">Chế độ đầu vào hiện tại chưa thể lưu dự án.</p>}
                                {authLoading && <p className="ai-studio__helper" role="status">Đang kiểm tra phiên đăng nhập…</p>}
                                {!authLoading && !isProjectAuthenticated && <p className="ai-studio__helper" role="status">Đăng nhập để lưu hoặc đọc dự án riêng tư.</p>}
                                {projectState?.message && !requiresManualProjectReconciliation && <p className={['error', 'validation-error', 'indeterminate', 'auth-required'].includes(projectState.phase) ? 'ai-studio__error' : 'ai-studio__notice'} role={['error', 'validation-error'].includes(projectState.phase) ? 'alert' : 'status'} aria-live="polite">{projectState.message}</p>}
                                {requiresManualProjectReconciliation && <p className="ai-studio__notice" role="status">{projectReconciliationMessage}</p>}
                                {projectState?.phase === 'indeterminate' && !canRetryProject && isProjectAuthenticated && !requiresManualProjectReconciliation && <p className="ai-studio__helper" role="status">Khôi phục đúng sản phẩm, phong cách, mô tả và ảnh của lần lưu trước để gửi lại cùng khóa idempotency.</p>}
                                {projectState?.projectId && projectState.phase === 'error' && canSaveProject && <StudioButton type="button" className="ai-studio__button--text" onClick={onReloadProject}>Đọc lại dự án</StudioButton>}
                                {inputMode === 'multi' && <p id="studio-multi-view-notice" className="ai-studio__notice" role="status">Lưu dự án gửi từ 2 đến 8 ảnh MULTI lên Design Project API. Generate Model chưa hỗ trợ đầu vào MULTI trên legacy Generation API. Lưu dự án không tạo ảnh tham chiếu AI hoặc GLB.</p>}
                                <StudioButton type="button" className="ai-studio__button--primary ai-studio__generate-button" disabled={generateActionDisabled} aria-describedby={inputMode === 'multi' && !activeJobId ? 'studio-multi-view-notice' : undefined} onClick={onGenerate}>
                                    <Icon>auto_awesome</Icon>{isGenerating ? 'Đang xử lý…' : activeJobId ? 'Theo dõi mô hình' : requestIndeterminate && inputMode !== 'multi' ? 'Gửi lại an toàn' : inputMode === 'multi' ? 'Tạo model chưa khả dụng' : 'Generate Model'}
                                </StudioButton>
                            </div>
                    </section>
                    </aside>

                    {!isCompactLayout && !panelCollapsed && workspaceMetrics.width > 0 && <div
                        ref={resizeHandleRef}
                        className="ai-studio__resize-handle"
                        role="separator"
                        tabIndex={0}
                        aria-label="Thay đổi độ rộng bảng ý tưởng"
                        aria-orientation="vertical"
                        aria-valuemin={getStudioSidebarBounds(workspaceMetrics.width, workspaceMetrics.dividerWidth, workspaceMetrics.historyWidth).min}
                        aria-valuemax={getStudioSidebarBounds(workspaceMetrics.width, workspaceMetrics.dividerWidth, workspaceMetrics.historyWidth).max}
                        aria-valuenow={effectiveSidebarWidth}
                        aria-valuetext={`${effectiveSidebarWidth} pixel`}
                        title="Kéo để thay đổi độ rộng bảng ý tưởng; dùng phím mũi tên để điều chỉnh"
                        onPointerDown={startSidebarResize}
                        onPointerMove={moveSidebarResize}
                        onPointerUp={finishSidebarResize}
                        onPointerCancel={finishSidebarResize}
                        onLostPointerCapture={finishSidebarResize}
                        onKeyDown={handleSidebarResizeKeyDown}
                    ><span aria-hidden="true" /></div>}

                    <section className="ai-studio__preview-panel" aria-label="Vùng xem trước">
                        <div className="ai-studio__mobile-tools">
                            <StudioButton
                                ref={mobileDrawerToggleRef}
                                type="button"
                                className="ai-studio__button--subtle ai-studio__mobile-open"
                                title={isMobileDrawerOpen ? 'Bảng ý tưởng đang mở' : 'Mở bảng ý tưởng'}
                                aria-label={isMobileDrawerOpen ? 'Bảng ý tưởng đang mở' : 'Mở bảng ý tưởng'}
                                aria-expanded={isMobileDrawerOpen}
                                aria-controls="studio-input-panel"
                                onClick={() => dispatchWorkspacePanel({ type: 'mobile-open' })}
                            ><Icon>tune</Icon><span>Ý tưởng của bạn</span></StudioButton>
                        </div>
                        <div className="ai-studio__preview-stage">
                                <div className="ai-studio__stage-toolbar">
                                <span>{isShowingDesignProjectModel ? 'Model của Design Project' : isGenerated ? 'Mô hình 3D' : inputMode === 'multi' ? `Góc ${viewSlots.find(slot => slot.id === selectedMultiView)?.label || 'Trước'}` : 'Ảnh 2D'}</span>
                                <span className="ai-studio__backend-state">{isShowingDesignProjectModel ? 'Artifact đã xác minh từ Backend' : isGenerated ? 'Đã xác nhận bởi Backend' : activeJobId ? 'Đang được Backend xử lý' : 'Chưa có kết quả được xác nhận'}</span>
                            </div>
                            {(genError || genStatus) && <div className={`ai-studio__stage-status ${genError ? 'is-error' : ''}`}>
                                {genError && <p role="alert">{genError}</p>}
                                {!genError && genStatus && <p role="status">{genStatus}</p>}
                            </div>}

                            <div className={`ai-studio__stage-content ${isGenerated || isShowingDesignProjectModel ? 'is-model' : ''}`}>
                                {isShowingDesignProjectModel ? designProjectModelViewer : isGenerated ? modelViewer : previewImage ? <button type="button" className="ai-studio__image-preview" onClick={() => setIsImageExpanded(true)} aria-label="Phóng to ảnh tham chiếu">
                                    <img src={previewImage} alt={inputMode === 'multi' ? `Ảnh góc ${viewSlots.find(slot => slot.id === selectedMultiView)?.label}` : 'Ảnh tham chiếu đã chọn'} style={{ transform: `scale(${imageZoom})` }} />
                                </button> : <div className="ai-studio__empty-state">
                                    <div className="ai-studio__empty-art" aria-hidden="true"><span className="ai-studio__art-shape ai-studio__art-shape--one" /><span className="ai-studio__art-shape ai-studio__art-shape--two" /><Icon>view_in_ar</Icon></div>
                                    <h2>Hôm nay bạn muốn tạo gì bằng 3D?</h2>
                                    <p>Chọn sản phẩm, kiểu thiết kế và cách nhập ý tưởng để bắt đầu.</p>
                                    <ul><li>Chọn sản phẩm và kiểu thiết kế.</li><li>Nhập mô tả hoặc tải ảnh tham chiếu.</li><li>Tạo mô hình khi API hiện tại hỗ trợ cách nhập đã chọn.</li></ul>
                                </div>}
                            </div>

                            {!isGenerated && previewImage && <div className="ai-studio__image-controls" aria-label="Điều khiển ảnh">
                                <StudioButton type="button" className="ai-studio__icon-button" onClick={() => setImageZoom(value => Math.max(.5, value - .15))} aria-label="Thu nhỏ ảnh"><Icon>zoom_out</Icon></StudioButton>
                                <StudioButton type="button" className="ai-studio__icon-button" onClick={() => setImageZoom(value => Math.min(2.5, value + .15))} aria-label="Phóng to ảnh"><Icon>zoom_in</Icon></StudioButton>
                                <StudioButton type="button" className="ai-studio__icon-button" onClick={() => setImageZoom(1)} aria-label="Đặt lại kích thước ảnh"><Icon>restart_alt</Icon></StudioButton>
                            </div>}

                            {!isGenerated && inputMode === 'multi' && viewSlots.some(slot => multiViews[slot.id]) && <div className="ai-studio__thumbnails" aria-label="Ảnh thu nhỏ các góc nhìn">
                                    {viewSlots.filter(slot => multiViews[slot.id]).map(slot => <button type="button" key={slot.id} aria-pressed={selectedMultiView === slot.id} onClick={() => setSelectedMultiView(slot.id)}>
                                    <img src={multiViews[slot.id].url} alt="" /><span>{slot.label}</span>
                                </button>)}
                            </div>}

                            {isShowingDesignProjectModel && <div className="ai-studio__model-actions ai-studio__project-print-gate">
                                <StudioButton type="button" className="ai-studio__button--secondary" disabled={!canOpenDesignProjectPrintPreparation} aria-describedby="design-project-print-gate" onClick={onOpenDesignProjectPrintPreparation}>Mở chuẩn bị cấu hình in</StudioButton>
                                <div id="design-project-print-gate" className="ai-studio__notice" role={['error', 'invalid'].includes(designProjectPrintReadinessState?.phase) ? 'alert' : 'status'}>
                                    {designProjectPrintReadinessState?.phase === 'loading' && (designProjectPrintReadinessState.message || 'Đang xác minh Print Readiness từ Backend…')}
                                    {designProjectPrintReadinessState?.phase === 'ready' && canOpenDesignProjectPrintPreparation && <>
                                        <p>Backend xác nhận READY cho model này: {designProjectPrintReadinessState.data.dimensionsMm.x} × {designProjectPrintReadinessState.data.dimensionsMm.y} × {designProjectPrintReadinessState.data.dimensionsMm.z} mm.</p>
                                        <p className="mt-1">Nguồn: {designProjectPrintReadinessState.data.dimensionSource} · Phương pháp: {designProjectPrintReadinessState.data.dimensionMethod} · Bằng chứng: {designProjectPrintReadinessState.data.provenanceId}</p>
                                        <p className="mt-1">Chỉ mở cấu hình tham khảo; chưa xác nhận khả năng in hoặc báo giá.</p>
                                    </>}
                                    {designProjectPrintReadinessState?.phase === 'ready' && !canOpenDesignProjectPrintPreparation && <p>Model hoặc digest hiện tại không khớp kết quả READY; bước tiếp theo vẫn bị khóa.</p>}
                                    {['not-ready', 'error', 'invalid'].includes(designProjectPrintReadinessState?.phase) && <>
                                        <p>{designProjectPrintReadinessState.message || 'Chưa xác minh được điều kiện chuẩn bị in từ Backend.'}</p>
                                        <StudioButton type="button" className="ai-studio__button--secondary mt-2" disabled={designProjectPrintReadinessState.phase === 'loading'} onClick={onRetryPrintReadiness}>Kiểm tra lại Print Readiness</StudioButton>
                                    </>}
                                    {designProjectPrintReadinessState?.phase === 'idle' && <p>Chưa có kết quả Print Readiness được xác nhận từ Backend.</p>}
                                </div>
                            </div>}

                            {isGenerated && !isShowingDesignProjectModel && <div className="ai-studio__model-actions">
                                <StudioButton type="button" className="ai-studio__button--secondary" onClick={() => openEditChat('direct-3d')}>Chỉnh sửa</StudioButton>
                                <StudioButton type="button" className="ai-studio__button--primary" onClick={onPrintAction}>Tiến tới đánh giá in</StudioButton>
                            </div>}

                            {!isGenerated && inputMode === 'image' && uploadedImg && <div className="ai-studio__model-actions">
                                <StudioButton type="button" className="ai-studio__button--secondary" onClick={() => openEditChat('image-then-3d')}>Chỉnh sửa ảnh</StudioButton>
                            </div>}

                            {!isGenerated && inputMode === 'multi' && previewImage && <div className="ai-studio__model-actions"><p className="ai-studio__notice">Tạo model từ nhiều ảnh chưa được hỗ trợ bởi API hiện tại.</p></div>}
                        </div>

                        {isChatOpen && <section className="ai-studio__chat" aria-label="Chỉnh sửa bằng hội thoại">
                            <header><div><p className="ai-studio__eyebrow">Không gian chỉnh sửa</p><h2>Trao đổi về thiết kế</h2></div><StudioButton type="button" className="ai-studio__icon-button" onClick={closeEditChat} aria-label="Đóng khung chỉnh sửa"><Icon>close</Icon></StudioButton></header>
                            {isGenerated && <div className="ai-studio__chat-modes" role="group" aria-label="Cách chỉnh sửa">
                                <button type="button" aria-pressed={chatMode === 'direct-3d'} onClick={() => setChatMode('direct-3d')}>Chỉnh trực tiếp 3D</button>
                                <button type="button" aria-pressed={chatMode === 'image-then-3d'} onClick={() => setChatMode('image-then-3d')}>Chỉnh ảnh 2D rồi tạo lại 3D</button>
                            </div>}
                            <div className="ai-studio__chat-empty"><strong>Chỉnh sửa chưa khả dụng.</strong> API chỉnh sửa chưa được tích hợp; nội dung và ảnh đính kèm chưa được gửi đi, mô hình không thay đổi.</div>
                            <form onSubmit={submitEditRequest}>
                                <textarea value={chatPrompt} onChange={event => setChatPrompt(event.target.value)} placeholder="Mô tả thay đổi bạn muốn…" aria-label="Yêu cầu chỉnh sửa" />
                                <div className="ai-studio__chat-actions">
                                    <label className="ai-studio__attach-button"><Icon>attach_file</Icon><span>Đính kèm ảnh</span><input type="file" accept="image/*" onChange={event => setChatAttachment(event.target.files?.[0] || null)} /></label>
                                    {chatAttachment && <span className="ai-studio__attachment-name">{chatAttachment.name}</span>}
                                    <StudioButton type="submit" className="ai-studio__button--primary" disabled={!chatPrompt.trim() && !chatAttachment}><Icon>send</Icon>Gửi yêu cầu</StudioButton>
                                </div>
                            </form>
                            {chatNotice && <p className="ai-studio__notice" role="status">{chatNotice}</p>}
                        </section>}
                    </section>
                    <aside className="ai-studio__history-panel" aria-label="Generation History">
                        <div className="ai-studio__history-panel-heading"><div><p className="ai-studio__eyebrow">Tài khoản của bạn</p><h2>Generation History</h2></div><Icon>history</Icon></div>
                        <section className="ai-studio__history-project-list" aria-label="Design Projects">
                            <h3>Dự án đã lưu</h3>
                            {['loading', 'refreshing'].includes(projectHistoryState.phase) && <p className="ai-studio__helper" role="status">{projectHistoryState.phase === 'loading' ? 'Đang tải danh sách dự án…' : 'Đang cập nhật danh sách dự án…'}</p>}
                            {['error', 'invalid', 'forbidden', 'auth-required'].includes(projectHistoryState.phase) && <div className="ai-studio__history-error">
                                <p className="ai-studio__error" role="alert">{projectHistoryState.message || 'Chưa tải được danh sách dự án.'}</p>
                                {projectHistoryState.phase !== 'auth-required' && <StudioButton type="button" className="ai-studio__button--text" onClick={onRetryProjectHistory}>Thử lại</StudioButton>}
                            </div>}
                            {projectHistoryState.phase === 'ready' && projectHistoryState.items.length === 0 && <p className="ai-studio__history-empty">Backend chưa có dự án đã lưu.</p>}
                            {projectHistoryState.items?.length > 0 && <div className="ai-studio__history-project-items">
                                {projectHistoryState.items.map((project) => {
                                    const updatedAt = typeof project.updatedAt === 'string' && Number.isFinite(Date.parse(project.updatedAt))
                                        ? new Date(project.updatedAt)
                                        : null;
                                    const updatedLabel = updatedAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(updatedAt) : null;
                                    const isCurrentProject = project.projectId === currentProjectId;
                                    const isLoadedCurrentProject = isCurrentProject
                                        && projectState?.phase === 'loaded'
                                        && projectState?.project?.projectId === project.projectId;
                                    const currentPipeline = pipelineState?.pipeline?.projectId === project.projectId ? pipelineState.pipeline : null;
                                    return <article key={project.projectId} className="ai-studio__history-project-entry">
                                        <button
                                            type="button"
                                            className="ai-studio__history-project-item"
                                            aria-current={isCurrentProject ? 'page' : undefined}
                                            onClick={() => onOpenProject?.(project)}
                                        >
                                            <span className="ai-studio__history-project-title">{project.originalIdea?.trim() || 'Dự án đã lưu'}</span>
                                            <span className="ai-studio__history-project-meta">{project.productType}{project.keychainVariant ? ` · ${project.keychainVariant}` : ''} · {project.inputMode}</span>
                                            <span className="ai-studio__history-project-status">{getPipelineStatusLabel(currentPipeline?.projectStatus || project.status, 'project')}</span>
                                            {updatedLabel && <time dateTime={project.updatedAt}>Cập nhật {updatedLabel}</time>}
                                        </button>
                                        {isLoadedCurrentProject && <ProjectDetailsPanel
                                            projectState={projectState}
                                            onReloadProject={onReloadProject}
                                            pipelineState={pipelineState}
                                            onReloadPipeline={onReloadPipeline}
                                            timelineState={timelineState}
                                            onReloadTimeline={onReloadTimeline}
                                            referenceViewState={referenceViewState}
                                            modelArtifactState={modelArtifactState}
                                            selectedReferenceVersionId={selectedReferenceVersionId}
                                            selectedModelVersionId={selectedModelVersionId}
                                            onSelectReferenceVersion={onSelectReferenceVersion}
                                            onSelectModelVersion={onSelectModelVersion}
                                            workflowCommandState={workflowCommandState}
                                            isWorkflowMutationInFlight={isWorkflowMutationInFlight}
                                            canMutate={isProjectAuthenticated}
                                            onGenerateReferences={onGenerateReferences}
                                            onApproveReferences={onApproveReferences}
                                            onGenerateModel={onGenerateModel}
                                            onApproveModel={onApproveModel}
                                        />}
                                    </article>;
                                })}
                            </div>}
                            {projectState?.phase === 'loaded'
                                && projectState.project?.projectId === currentProjectId
                                && !projectHistoryState.items?.some((project) => project.projectId === currentProjectId)
                                && <ProjectDetailsPanel
                                    projectState={projectState}
                                    onReloadProject={onReloadProject}
                                    pipelineState={pipelineState}
                                    onReloadPipeline={onReloadPipeline}
                                    timelineState={timelineState}
                                    onReloadTimeline={onReloadTimeline}
                                    referenceViewState={referenceViewState}
                                    modelArtifactState={modelArtifactState}
                                    selectedReferenceVersionId={selectedReferenceVersionId}
                                    selectedModelVersionId={selectedModelVersionId}
                                    onSelectReferenceVersion={onSelectReferenceVersion}
                                    onSelectModelVersion={onSelectModelVersion}
                                    workflowCommandState={workflowCommandState}
                                    isWorkflowMutationInFlight={isWorkflowMutationInFlight}
                                    canMutate={isProjectAuthenticated}
                                    onGenerateReferences={onGenerateReferences}
                                    onApproveReferences={onApproveReferences}
                                    onGenerateModel={onGenerateModel}
                                    onApproveModel={onApproveModel}
                                />}
                            {projectHistoryState.pageError && <div className="ai-studio__history-error">
                                <p className="ai-studio__error" role="alert">{projectHistoryState.pageError}</p>
                                <StudioButton type="button" className="ai-studio__button--text" onClick={onLoadMoreProjects}>Thử tải lại trang tiếp theo</StudioButton>
                            </div>}
                            {projectHistoryState.phase === 'ready' && !projectHistoryState.last && !projectHistoryState.pageError && <StudioButton
                                type="button"
                                className="ai-studio__button--text"
                                disabled={projectHistoryState.loadingMore}
                                aria-busy={projectHistoryState.loadingMore}
                                onClick={onLoadMoreProjects}
                            >{projectHistoryState.loadingMore ? 'Đang tải thêm…' : 'Tải thêm dự án'}</StudioButton>}
                        </section>
                        <section className="ai-studio__legacy-history" aria-label="Legacy Generation History">
                            <h3>Mô hình tạo theo lịch sử generation cũ</h3>
                        {historyItems.length === 0 ? <p className="ai-studio__history-empty">Chưa có mô hình hoàn tất trong tài khoản này.</p> : <div className="ai-studio__history-list">
                            {historyItems.map(item => <button type="button" key={item.id || item.modelUrl} onClick={() => onSelectGeneration(item)} aria-current={selectedGeneration?.id === item.id ? 'true' : undefined}>
                                {item.img ? <img src={item.img} alt="" /> : <span className="ai-studio__history-model-icon"><Icon>view_in_ar</Icon></span>}
                                <span>{item.title || 'Mô hình đã tạo'}</span>
                            </button>)}
                        </div>}
                        </section>
                    </aside>
                </div>

                {isImageExpanded && previewImage && <div className="ai-studio__image-lightbox" role="dialog" aria-modal="true" aria-label="Ảnh tham chiếu phóng to" onClick={() => setIsImageExpanded(false)}>
                    <StudioButton type="button" className="ai-studio__icon-button" onClick={() => setIsImageExpanded(false)} aria-label="Đóng ảnh"><Icon>close</Icon></StudioButton>
                    <img src={previewImage} alt="Ảnh tham chiếu phóng to" onClick={event => event.stopPropagation()} />
                </div>}
            </div>
        </div>
    );
}
