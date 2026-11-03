import { lazy, Suspense, useState, useRef, useEffect, useReducer } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createAIGeneration } from '../services/aiStudioService';
import { getStudioInputMode } from '../features/ai-studio/inputMode';
import { clearPendingGenerationState, createGenerationResultsState, createPrintDraftFromGeneration, generationResultsReducer, generationSubmissionReducer, getGenerationOwnerKey, getGenerationResultsForOwner, initialGenerationSubmissionState, persistPendingGenerationState, resolveGenerationResponse, restorePendingGenerationState } from '../features/ai-studio/generationPresentation';
import { validateStudioImage } from '../features/ai-studio/uploadValidation';
import { getStudioApiInputMode, initialViewerCustomizationState, viewerCustomizationReducer, viewerCustomizationToPrintDraftOptions } from '../features/ai-studio/studioPresentation.js';
import AIStudioWorkspace from './AIStudioWorkspace.jsx';
import './ai-studio.css';

const ThreeDViewer = lazy(() => import('../components/ThreeDViewer'));

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
    const [quality, setQuality] = useState('High');
    const [style, setStyle] = useState('Realistic');
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
    const [uploadError, setUploadError] = useState('');

    useEffect(() => {
        setInputMode(getStudioInputMode(location.search, editDraft));
    }, [location.search, editDraft]);
    const [showPrintNameDialog, setShowPrintNameDialog] = useState(false);
    const [printProductName, setPrintProductName] = useState('');
    const [printDraftError, setPrintDraftError] = useState('');
    const [pendingOwnerReadyKey, setPendingOwnerReadyKey] = useState(undefined);
    const uploadedObjectUrlRef = useRef(null);
    const [generationMessageOwnerKey, setGenerationMessageOwnerKey] = useState(generationSessionKey);
    const [genError, setGenError] = useState('');
    const [genStatus, setGenStatus] = useState(() => {
        if (generationSubmission.status !== 'pending') return '';
        return generationSubmission.previousRequestMayStillRun
            ? 'Một yêu cầu tạo model trước đó có thể vẫn đang chạy trên máy chủ. Không có trạng thái hoàn tất được xác nhận.'
            : 'Một yêu cầu tạo model trước đó đang chờ máy chủ. Studio không tự theo dõi trạng thái.';
    });
    const generationInFlightOwnersRef = useRef(new Set());
    const pendingGenerationOwnerRef = useRef(null);
    const generationOwnerKeyRef = useRef(generationSessionKey);
    generationOwnerKeyRef.current = generationSessionKey;
    const visibleGenError = generationMessageOwnerKey === generationSessionKey ? genError : '';
    const visibleGenStatus = generationMessageOwnerKey === generationSessionKey ? genStatus : '';
    const pendingOwnerReady = !authLoading
        && pendingOwnerReadyKey !== undefined
        && pendingOwnerReadyKey === generationSessionKey;
    const isGenerating = pendingOwnerReady && generationSubmission.status === 'submitting';
    const isGenerationPending = pendingOwnerReady
        && generationSubmission.status === 'pending'
        && pendingGenerationOwnerRef.current === generationOwnerKey;

    useEffect(() => {
        if (authLoading) {
            setPendingOwnerReadyKey(undefined);
            return;
        }

        let restored = null;
        try {
            restored = restorePendingGenerationState(window.sessionStorage, persistedGenerationOwnerKey);
        } catch {
            restored = null;
        }
        dispatchGeneration({ type: 'restore', state: restored || initialGenerationSubmissionState });
        pendingGenerationOwnerRef.current = restored ? generationOwnerKey : null;
        dispatchGenerationResults({ type: 'reset-owner', ownerKey: generationSessionKey });
        setGenerationMessageOwnerKey(generationSessionKey);
        setGenError('');
        setShowPrintNameDialog(false);
        setPrintProductName('');
        setPrintDraftError('');
        setGenStatus(restored
            ? restored.previousRequestMayStillRun
                ? 'Một yêu cầu tạo model trước đó có thể vẫn đang chạy trên máy chủ. Không có trạng thái hoàn tất được xác nhận.'
                : 'Một yêu cầu tạo model trước đó đang chờ máy chủ. Studio không tự theo dõi trạng thái.'
            : '');
        setPendingOwnerReadyKey(generationSessionKey);
    }, [authLoading, generationOwnerKey, generationSessionKey, persistedGenerationOwnerKey]);

    useEffect(() => () => {
        if (uploadedObjectUrlRef.current) {
            URL.revokeObjectURL(uploadedObjectUrlRef.current);
            uploadedObjectUrlRef.current = null;
        }
    }, []);

    function releaseUploadedObjectUrl() {
        if (!uploadedObjectUrlRef.current) return;
        URL.revokeObjectURL(uploadedObjectUrlRef.current);
        uploadedObjectUrlRef.current = null;
    }

    function setUploadedFile(file) {
        const validationError = validateStudioImage(file);
        if (validationError) {
            setUploadError(validationError);
            return;
        }

        const nextUrl = URL.createObjectURL(file);
        releaseUploadedObjectUrl();
        uploadedObjectUrlRef.current = nextUrl;
        setUploadedImg(nextUrl);
        setUploadError('');
    }

    function clearUploadedFile() {
        releaseUploadedObjectUrl();
        setUploadedImg(null);
        setUploadError('');
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

    async function handleGenerate() {
        if (!pendingOwnerReady || generationInFlightOwnersRef.current.has(generationOwnerKey)
            || pendingGenerationOwnerRef.current === generationOwnerKey) return;
        if (!apiInputMode) {
            setGenError('API hiện tại chưa hỗ trợ gửi nhiều góc nhìn trong cùng một yêu cầu.');
            return;
        }
        if (!hasInput) {
            setGenError(inputMode === 'text' ? 'Vui lòng nhập mô tả mô hình.' : 'Vui lòng tải lên một hình ảnh.');
            return;
        }
        const requestOwnerKey = generationSessionKey;
        const requestGuardKey = generationOwnerKey;
        const requestStorageOwnerKey = persistedGenerationOwnerKey;
        const previousRequestMayStillRun = generationSubmission.previousRequestMayStillRun;
        generationInFlightOwnersRef.current.add(requestGuardKey);
        dispatchGeneration({ type: 'submit' });
        setGenerationMessageOwnerKey(requestOwnerKey);
        setGenError('');
        if (!previousRequestMayStillRun) setGenStatus('');
        dispatchGenerationResults({ type: 'start', ownerKey: requestOwnerKey });
        let failureState = 'failed';
        let requestSent = false;
        let requestTerminal = false;

        try {
            // Attempt real API call
            const data = { prompt: textPrompt, quality, style, inputMode: apiInputMode };
            let imageFile = null;
            if (inputMode === 'image' && uploadedImg) {
                const response = await fetch(uploadedImg);
                const blob = await response.blob();
                imageFile = new File([blob], 'input.png', { type: blob.type });
            }
            if (generationOwnerKeyRef.current !== requestOwnerKey) return;
            try {
                persistPendingGenerationState(window.sessionStorage, requestStorageOwnerKey, previousRequestMayStillRun);
            } catch {
                // The in-memory request lock still protects this mounted page.
            }
            requestSent = true;
            const result = await createAIGeneration(data, imageFile);
            const resolution = resolveGenerationResponse(result);
            if (resolution.state === 'pending') {
                try {
                    persistPendingGenerationState(window.sessionStorage, requestStorageOwnerKey, previousRequestMayStillRun);
                } catch {
                    // The in-memory pending guard remains active for this account.
                }
                if (generationOwnerKeyRef.current !== requestOwnerKey) return;
                pendingGenerationOwnerRef.current = generationOwnerKey;
                dispatchGeneration({ type: 'pending' });
                setGenStatus(previousRequestMayStillRun
                    ? 'Yêu cầu trước có thể vẫn chạy trên máy chủ. Yêu cầu hiện tại cũng đang chờ; Studio chưa theo dõi trạng thái tự động.'
                    : 'Máy chủ cho biết yêu cầu đang được xử lý. Studio chưa theo dõi trạng thái tự động; chưa có mô hình để xem.');
                return;
            }
            if (resolution.state === 'failed') {
                failureState = 'failed';
                requestTerminal = true;
                throw new Error('Máy chủ báo quá trình tạo mô hình thất bại. Vui lòng thử lại sau.');
            }
            if (resolution.state !== 'completed') {
                failureState = 'invalid';
                throw new Error('Phản hồi chưa xác nhận mô hình hoàn tất hoặc thiếu dữ liệu mô hình cần thiết.');
            }

            const generated = resolution.generation;
            requestTerminal = true;
            try {
                if (previousRequestMayStillRun) persistPendingGenerationState(window.sessionStorage, requestStorageOwnerKey, true);
                else clearPendingGenerationState(window.sessionStorage, requestStorageOwnerKey);
            } catch {
                // Completion remains usable even if session storage is unavailable.
            }
            if (generationOwnerKeyRef.current !== requestOwnerKey) return;
            dispatchGeneration({ type: 'completed' });
            dispatchGenerationResults({ type: 'completed', ownerKey: requestOwnerKey, generation: generated });
            resetCustomization(generated);
        } catch (error) {
            if (requestSent && !requestTerminal) {
                try {
                    persistPendingGenerationState(window.sessionStorage, requestStorageOwnerKey, true);
                } catch {
                    // Keep the unknown-outcome guard in memory when storage is unavailable.
                }
                if (generationOwnerKeyRef.current !== requestOwnerKey) return;
                pendingGenerationOwnerRef.current = generationOwnerKey;
                dispatchGeneration({ type: 'indeterminate' });
                setGenStatus('Chưa xác nhận được kết quả. Yêu cầu có thể vẫn đang chạy trên máy chủ; không có xác nhận hủy.');
                setGenError(error instanceof Error && error.message
                    ? error.message
                    : 'Không nhận được kết quả xác nhận từ máy chủ.');
                return;
            }
            try {
                if (previousRequestMayStillRun) persistPendingGenerationState(window.sessionStorage, requestStorageOwnerKey, true);
                else clearPendingGenerationState(window.sessionStorage, requestStorageOwnerKey);
            } catch {
                // Error reporting remains available even if session storage is unavailable.
            }
            if (generationOwnerKeyRef.current !== requestOwnerKey) return;
            dispatchGeneration({ type: failureState });
            setGenError(error instanceof Error && error.message
                ? error.message
                : 'Không thể tạo mô hình lúc này. Vui lòng thử lại sau.');
        } finally {
            generationInFlightOwnersRef.current.delete(requestGuardKey);
        }
    }

    function allowNewGenerationRequest() {
        if (!pendingOwnerReady || pendingGenerationOwnerRef.current !== generationOwnerKey) return;
        pendingGenerationOwnerRef.current = null;
        dispatchGeneration({ type: 'allow-new-request' });
        try {
            persistPendingGenerationState(window.sessionStorage, persistedGenerationOwnerKey, true);
        } catch {
            // The visible warning remains active if session storage is unavailable.
        }
        setGenStatus('Yêu cầu trước chưa được xác nhận hoàn tất và có thể vẫn đang chạy trên máy chủ. Tiếp tục sẽ gửi một yêu cầu riêng; không có xác nhận hủy yêu cầu trước.');
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
                setInputMode={setInputMode}
                textPrompt={textPrompt}
                setTextPrompt={setTextPrompt}
                uploadedImg={uploadedImg}
                onUploadFile={setUploadedFile}
                clearUploadedFile={clearUploadedFile}
                uploadError={uploadError}
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
                                    setInputMode(imageDataUrl ? 'image' : 'text');
                                    setTextPrompt(prompt);
                                    releaseUploadedObjectUrl();
                                    setUploadedImg(imageDataUrl);
                                    dispatchGenerationResults({ type: 'reset-preview', ownerKey: generationSessionKey });
                                }}
                            />
                        </Suspense>
                    </div>
                ) : null}
                isGenerating={isGenerating}
                isGenerationPending={isGenerationPending}
                canSubmit={pendingOwnerReady}
                onGenerate={handleGenerate}
                onAllowNewRequest={allowNewGenerationRequest}
                genError={visibleGenError}
                genStatus={visibleGenStatus}
                historyItems={sessionHistory}
                onSelectGeneration={handleSelectGeneration}
                onPrintAction={requestPrintPreparation}
                onResetPreview={() => dispatchGenerationResults({ type: 'reset-preview', ownerKey: generationSessionKey })}
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
