import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getDimensionScalePercentages, getPrintDraftDimensions, isValidPrintDraft, scalePrintDimensions } from '../features/print-quote/printQuotePresentation';
import './print-quote.css';

const ThreeDViewer = lazy(() => import('../components/ThreeDViewer'));

const MATERIALS = [
    {
        id: 'pla',
        name: 'PLA',
        description: 'Bề mặt đẹp, phù hợp trưng bày',
        density: 1.24,
        flow: 5.2,
        color: '#7c3aed',
    },
    {
        id: 'petg',
        name: 'PETG',
        description: 'Bền và chịu va đập tốt hơn',
        density: 1.27,
        flow: 4.5,
        color: '#0e7490',
    },
    {
        id: 'resin',
        name: 'Resin',
        description: 'Chi tiết mịn cho mẫu trưng bày',
        density: 1.1,
        flow: 3.2,
        color: '#ec4899',
    },
];

const USE_CASES = [
    { id: 'display', label: 'Trưng bày', icon: 'deployed_code' },
    { id: 'gift', label: 'Quà tặng', icon: 'redeem' },
    { id: 'functional', label: 'Sử dụng thực tế', icon: 'build' },
];

function parseDimensions(value, scale = {}) {
    return getPrintDraftDimensions(value, scale) || { x: 100, y: 100, z: 20 };
}

function QuoteRow({ label, value }) {
    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold text-pocket-plum">{value}</span>
        </div>
    );
}

export default function PrintQuotePage() {
    const { state } = useLocation();
    const draft = state?.printDraft;
    const [materialId, setMaterialId] = useState('pla');
    const [useCase, setUseCase] = useState('display');
    const [layerHeight, setLayerHeight] = useState(0.2);
    const [infill, setInfill] = useState(15);
    const [walls, setWalls] = useState(3);
    const [needsSupport, setNeedsSupport] = useState(false);
    const [quantity, setQuantity] = useState(1);
    const originalDimensions = useMemo(
        () => parseDimensions(draft?.dimensions),
        [draft?.dimensions],
    );
    const baseDimensions = useMemo(
        () => parseDimensions(draft?.dimensions, draft?.modelScale),
        [draft?.dimensions, draft?.modelScale],
    );
    const studioScale = getDimensionScalePercentages(originalDimensions, baseDimensions) || { x: 100, y: 100, z: 100 };
    const [dimensions, setDimensions] = useState(() => parseDimensions(draft?.dimensions, draft?.modelScale));
    const [finalFormat, setFinalFormat] = useState(() => (
        String(draft?.format || '').toLowerCase() === 'glb' ? 'glb' : 'stl'
    ));
    const [colorMode, setColorMode] = useState(() => (
        String(draft?.format || '').toLowerCase() === 'glb'
            && (Object.keys(draft?.partColors || {}).length || draft?.modelColor)
            ? 'color'
            : 'mono'
    ));
    const [previewCreated, setPreviewCreated] = useState(false);
    const [chatInput, setChatInput] = useState('');

    const material = MATERIALS.find(item => item.id === materialId) || MATERIALS[0];
    const productName = draft?.productName?.trim() || draft?.title || 'Mô hình 3D';
    const printScale = getDimensionScalePercentages(baseDimensions, dimensions) || { x: 100, y: 100, z: 100 };
    const formattedDimensions = `${dimensions.x} x ${dimensions.y} x ${dimensions.z} mm`;
    const previewParts = useMemo(() => (
        (draft?.parts || []).map(part => ({
            ...part,
            color: finalFormat === 'glb' && colorMode === 'color'
                ? (draft?.partColors?.[part.id] || part.color)
                : '#94a3b8',
        }))
    ), [colorMode, draft?.partColors, draft?.parts, finalFormat]);
    const quote = useMemo(() => {
        const boundingVolume = (dimensions.x * dimensions.y * dimensions.z) / 1000;
        const shellAndInfill = 0.22 + (walls * 0.055) + (infill / 100) * 0.55;
        const supportFactor = needsSupport ? 1.18 : 1;
        const useFactor = useCase === 'functional' ? 1.12 : useCase === 'gift' ? 1.05 : 1;
        const printableVolume = boundingVolume * 0.15 * shellAndInfill * supportFactor * useFactor;
        const weight = printableVolume * material.density;
        const hours = (0.45 + printableVolume / material.flow) * (0.2 / layerHeight);
        return { printableVolume, weight, hours };
    }, [dimensions, infill, layerHeight, material, needsSupport, useCase, walls]);

    const initialMessages = useMemo(() => [
        {
            id: 'welcome',
            role: 'guide',
            text: `Mô phỏng thông số theo ${material.name}, layer ${layerHeight} mm và ${infill}% infill. Đây là gợi ý cục bộ, chưa được Backend hoặc kỹ thuật xác nhận.`,
        },
    ], [infill, layerHeight, material.name]);
    const [messages, setMessages] = useState(initialMessages);

    if (!isValidPrintDraft(draft)) {
        return (
            <div className="print-quote-page print-quote-page--empty">
                <div className="mx-auto max-w-xl px-6 text-center">
                    <span className="material-symbols-outlined text-[64px] text-pocket-lavender">view_in_ar</span>
                    <h1 className="mt-4 text-3xl font-extrabold text-pocket-plum">Chưa có dữ liệu mô hình hợp lệ</h1>
                    <p className="mt-3 text-slate-600">Cần có model và kích thước hợp lệ từ AI Studio để chuẩn bị cấu hình in.</p>
                    <Link to="/studio" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white">
                        Mở AI Studio <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </Link>
                </div>
            </div>
        );
    }

    function buildAdvice(prompt) {
        const normalized = prompt.toLowerCase();
        if (normalized.includes('support') || normalized.includes('đỡ')) {
            return needsSupport
                ? 'Mô phỏng hiện đã bật support. Hướng đặt và nhu cầu support thực tế cần được xác nhận sau khi kiểm tra file.'
                : 'Mô phỏng hiện chưa tính support. Chưa thể xác nhận khả năng in cho đến khi file được kiểm tra.';
        }
        if (normalized.includes('nhựa') || normalized.includes('chất liệu') || normalized.includes('material')) {
            return `Bạn đang chọn ${material.name}. Gợi ý này dựa trên quy tắc cục bộ; tính tương thích, độ bền và chi phí cần được xác nhận theo vật liệu và quy trình thực tế.`;
        }
        if (normalized.includes('thời gian') || normalized.includes('lâu')) {
            return `Mô phỏng cục bộ khoảng ${quote.hours.toFixed(1)} giờ cho mỗi sản phẩm. Thời gian thực tế chưa được Backend hoặc kỹ thuật xác nhận.`;
        }
        return `Cấu hình ${material.name}, ${walls} walls và ${infill}% infill được hiển thị để tham khảo cho mục đích ${USE_CASES.find(item => item.id === useCase)?.label.toLowerCase()}. Chưa có xác nhận khả năng in hoặc báo giá.`;
    }

    function askAdvisor(prompt) {
        const value = (prompt || chatInput).trim();
        if (!value) return;
        setMessages(current => [
            ...current,
            { id: `user-${Date.now()}`, role: 'user', text: value },
            { id: `guide-${Date.now()}`, role: 'guide', text: buildAdvice(value) },
        ]);
        setChatInput('');
    }

    function createRequestPreview() {
        setPreviewCreated(true);
        setMessages(current => [
            ...current,
            {
                id: `preview-${Date.now()}`,
                role: 'user',
                text: `Bản xem trước cấu hình: ${productName} · ${quantity} sản phẩm · ${material.name} · ${finalFormat.toUpperCase()} · ${colorMode === 'color' ? 'có màu' : 'không màu'} · ${formattedDimensions}.`,
            },
            {
                id: `preview-status-${Date.now()}`,
                role: 'guide',
                text: 'Bản xem trước chỉ tồn tại trong trang này. Chưa gửi tới máy chủ và chưa có xác nhận từ đội kỹ thuật.',
            },
        ]);
    }

    function updatePrintDimension(axis, rawValue) {
        setDimensions(scalePrintDimensions(baseDimensions, axis, rawValue));
    }

    function selectFinalFormat(format) {
        setFinalFormat(format);
        if (format === 'stl') setColorMode('mono');
    }

    const materialLabel = `${material.name} · ${layerHeight} mm · ${infill}% infill`;

    return (
        <div className="print-quote-page">
            <div className="print-quote__container">
                <div className="print-quote__header">
                    <div>
                        <Link to="/studio" className="print-quote__back mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-brand-primary hover:text-brand-hover">
                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                            Quay lại AI Studio
                        </Link>
                        <h1 className="text-3xl font-extrabold text-pocket-plum md:text-4xl">Chuẩn bị in 3D</h1>
                    </div>
                    <div className="print-quote__snapshot flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold text-brand-primary">
                        <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
                        Snapshot từ AI Studio
                    </div>
                </div>

                <div className="print-quote__steps mb-7 grid grid-cols-2 overflow-hidden rounded-xl border bg-white sm:grid-cols-4">
                    {[
                        ['check', 'Mô hình', true],
                        ['tune', 'Chuẩn bị in', true],
                        ['engineering', 'Chờ kết nối kỹ thuật', false],
                        ['shopping_cart', 'Đặt hàng', false],
                    ].map(([icon, label, complete], index) => (
                        <div key={label} className={`flex items-center gap-2 border-b border-slate-100 px-3 py-3 text-xs font-bold sm:border-b-0 ${index < 3 ? 'sm:border-r' : ''} ${complete ? 'text-brand-hover' : 'text-slate-400'}`}>
                            <span className={`material-symbols-outlined text-[18px] ${complete ? 'text-brand-primary' : ''}`}>{icon}</span>
                            {label}
                        </div>
                    ))}
                </div>

                <div className="print-quote__layout grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-6">
                        <section className="print-quote__card print-quote__preview-grid grid overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                            <div className="print-quote__viewer relative h-[420px] overflow-hidden md:h-[500px]">
                                <Suspense fallback={<div className="flex h-full items-center justify-center bg-pocket-lavender"><div className="flex flex-col items-center gap-3 text-brand-primary"><span className="h-9 w-9 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" /><span className="text-xs font-bold">Đang tải bản xem trước 3D…</span></div></div>}>
                                    <ThreeDViewer
                                        modelUrl={draft.modelUrl}
                                        imgSrc={draft.img}
                                        modelColor={finalFormat === 'glb' && colorMode === 'color' ? (draft?.modelColor || '#a78bfa') : '#94a3b8'}
                                        dimensions={formattedDimensions}
                                        partDefinitions={previewParts}
                                        presentationMode
                                        fixedExportFormat={finalFormat}
                                        allowDownload={false}
                                    />
                                </Suspense>
                                <div className="print-quote__viewer-controls absolute bottom-4 right-4 z-30 flex items-center rounded-xl border p-1.5 shadow-lg backdrop-blur">
                                    {['stl', 'glb'].map(format => (
                                        <button key={format} type="button" aria-pressed={finalFormat === format} onClick={() => selectFinalFormat(format)} className={`min-h-10 rounded-lg px-3 text-xs font-extrabold transition-colors ${finalFormat === format ? 'bg-brand-primary text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}>{format.toUpperCase()}</button>
                                    ))}
                                    {finalFormat === 'glb' && <span className="ml-1 flex items-center border-l border-white/20 pl-1"><button type="button" aria-label="Xem GLB có màu" aria-pressed={colorMode === 'color'} onClick={() => setColorMode('color')} className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMode === 'color' ? 'bg-brand-primary text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}><span className="material-symbols-outlined text-[17px]">palette</span></button><button type="button" aria-label="Xem GLB không màu" aria-pressed={colorMode === 'mono'} onClick={() => setColorMode('mono')} className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMode === 'mono' ? 'bg-brand-primary text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}><span className="material-symbols-outlined text-[17px]">contrast</span></button></span>}
                                </div>
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent px-5 pb-5 pt-16 text-white">
                                    <p className="text-xs font-semibold text-pocket-pink">Mô hình đã chọn</p>
                                    <h2 className="mt-1 text-xl font-extrabold">{productName}</h2>
                                    <p className="mt-1 text-xs text-white/75">{draft.format || 'Định dạng chưa có'}{draft.quality ? ` · ${draft.quality}` : ''}</p>
                                </div>
                            </div>
                            <div className="print-quote__snapshot-details p-5 md:p-6">
                                <div className="mb-5 flex items-center justify-between">
                                    <h2 className="text-lg font-extrabold text-slate-900">Thông số snapshot</h2>
                                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">{finalFormat.toUpperCase()}</span>
                                </div>
                                <div className="space-y-3 text-sm">
                                    <QuoteRow label="Kích thước model ban đầu" value={`${originalDimensions.x} × ${originalDimensions.y} × ${originalDimensions.z} mm`} />
                                    <QuoteRow label="Kích thước nhận từ AI Studio" value={`${baseDimensions.x} × ${baseDimensions.y} × ${baseDimensions.z} mm`} />
                                    <QuoteRow label="Tỷ lệ AI Studio theo trục" value={`X ${studioScale.x}% · Y ${studioScale.y}% · Z ${studioScale.z}%`} />
                                    <QuoteRow label="Tỷ lệ Print Quote so với snapshot" value={`X ${printScale.x}% · Y ${printScale.y}% · Z ${printScale.z}%`} />
                                    <QuoteRow label="Màu tùy chỉnh" value={`${Object.keys(draft.partColors || {}).length} chi tiết`} />
                                </div>
                                <div className="mt-5 border-t border-slate-100 pt-5">
                                    <div className="mb-2 flex items-center gap-1 text-xs font-bold text-brand-primary">
                                        <span className="material-symbols-outlined text-[14px]">lock</span>
                                        Giữ nguyên tỷ lệ ba chiều
                                    </div>
                                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Kích thước in (mm)</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['x', 'y', 'z'].map(axis => (
                                            <label key={axis} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center">
                                                <span className="block text-xs font-bold uppercase text-slate-400">{axis}</span>
                                                <input
                                                    type="number"
                                                    min="0.1"
                                                    max="1000"
                                                    step="0.1"
                                                    value={dimensions[axis]}
                                                    onChange={event => updatePrintDimension(axis, event.target.value)}
                                                    className="mt-1 w-full bg-transparent text-center text-sm font-extrabold text-slate-800 outline-none"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-xs leading-relaxed text-slate-500">Đổi một thông số, hai chiều còn lại sẽ tự cập nhật theo tỷ lệ gốc để model không bị méo.</p>
                                </div>

                                <div className="hidden">
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-primary material-symbols-outlined">view_in_ar</span>
                                        <div>
                                            <h3 className="text-sm font-extrabold text-slate-900">Model 3D chốt với khách</h3>
                                            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Đây là cấu hình file đội kỹ thuật sẽ dùng để duyệt và bàn giao.</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-2.5">
                                        <img src={draft.img} alt="" className="h-12 w-12 rounded-md object-cover" />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-extrabold text-slate-800">{draft.title}</p>
                                            <p className="mt-0.5 text-xs text-slate-500">{formattedDimensions}</p>
                                        </div>
                                        <span className="rounded-md bg-white px-2 py-1 text-xs font-extrabold text-brand-primary shadow-sm">{finalFormat.toUpperCase()}</span>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        {[
                                            ['stl', 'STL', 'File in 3D'],
                                            ['glb', 'GLB', 'Giữ dữ liệu màu'],
                                        ].map(([format, label, detail]) => (
                                            <button
                                                key={format}
                                                type="button"
                                                onClick={() => selectFinalFormat(format)}
                                                className={`rounded-lg border p-3 text-left transition-colors ${finalFormat === format ? 'border-brand-primary bg-brand-soft' : 'border-slate-200 hover:border-brand-light/20'}`}
                                            >
                                                <span className="block text-sm font-extrabold text-slate-800">{label}</span>
                                                <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            disabled={finalFormat === 'stl'}
                                            onClick={() => setColorMode('color')}
                                            className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${colorMode === 'color' ? 'border-brand-primary bg-brand-soft text-brand-hover' : 'border-slate-200 text-slate-600 hover:border-brand-light/20'}`}
                                        >
                                            <span className="material-symbols-outlined text-[19px]">palette</span>
                                            <span><span className="block text-xs font-extrabold">Có màu</span><span className="block text-xs">Theo tùy chỉnh</span></span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setColorMode('mono')}
                                            className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 text-left transition-colors ${colorMode === 'mono' ? 'border-brand-primary bg-brand-soft text-brand-hover' : 'border-slate-200 text-slate-600 hover:border-brand-light/20'}`}
                                        >
                                            <span className="material-symbols-outlined text-[19px]">contrast</span>
                                            <span><span className="block text-xs font-extrabold">Không màu</span><span className="block text-xs">Một vật liệu</span></span>
                                        </button>
                                    </div>

                                    {finalFormat === 'glb' && colorMode === 'color' && (
                                        <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                                            <span className="text-xs font-semibold text-slate-500">Màu chi tiết đã chốt</span>
                                            <div className="flex -space-x-1.5">
                                                {(draft.parts || []).slice(0, 6).map(part => (
                                                    <span key={part.id} title={part.name} className="h-5 w-5 rounded-full border-2 border-white" style={{ backgroundColor: draft.partColors?.[part.id] || part.color || '#cbd5e1' }} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                                        {finalFormat === 'stl'
                                            ? 'STL chỉ lưu hình học, không chứa màu. Màu in thực tế sẽ được kỹ thuật xác nhận theo vật liệu.'
                                            : colorMode === 'color'
                                                ? 'GLB lưu bản xem trước và màu từng chi tiết để chốt với khách.'
                                                : 'GLB được bàn giao ở chế độ không màu, phù hợp khi chỉ cần hình học model.'}
                                    </p>
                                </div>

                                <div className="hidden">
                                    <div className="rounded-lg bg-slate-50 px-3 py-2.5"><span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Kích thước chốt</span><span className="mt-1 block text-xs font-extrabold text-slate-800">{formattedDimensions}</span></div>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2.5"><span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Chất lượng</span><span className="mt-1 block text-xs font-extrabold text-slate-800">{draft.quality || 'High'}</span></div>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2.5"><span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Dữ liệu model</span><span className="mt-1 block text-xs font-extrabold text-slate-800">{draft.faces || 'Đang đồng bộ'} faces</span></div>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2.5"><span className="block text-xs font-bold uppercase tracking-wide text-slate-400">Trạng thái</span><span className="mt-1 block text-xs font-extrabold text-emerald-600">Sẵn sàng duyệt</span></div>
                                </div>
                            </div>
                        </section>

                        <section className="print-quote__card p-5 md:p-6">
                            <div className="mb-5 flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand-primary material-symbols-outlined">tune</span>
                                <div><h2 className="font-extrabold text-slate-900">Cấu hình in</h2><p className="text-xs text-slate-500">Điều chỉnh để xem ước tính thay đổi ngay.</p></div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Mục đích sử dụng</p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        {USE_CASES.map(item => <button key={item.id} type="button" onClick={() => setUseCase(item.id)} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors ${useCase === item.id ? 'border-brand-primary bg-brand-soft text-brand-hover' : 'border-slate-200 text-slate-600 hover:border-brand-light/20'}`}><span className="material-symbols-outlined text-[16px]">{item.icon}</span>{item.label}</button>)}
                                    </div>
                                </div>
                                <div>
                                    <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Chất liệu</p></div>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {MATERIALS.map(item => <button key={item.id} type="button" onClick={() => setMaterialId(item.id)} className={`rounded-lg border p-3 text-left transition-colors ${materialId === item.id ? 'border-brand-primary bg-brand-soft' : 'border-slate-200 hover:border-brand-light/20'}`}><span className="mb-2 block h-2 w-8 rounded-full" style={{ backgroundColor: item.color }} /><span className="block text-sm font-extrabold text-slate-800">{item.name}</span><span className="mt-1 block text-xs leading-relaxed text-slate-500">{item.description}</span></button>)}
                                    </div>
                                </div>
                                <div className="grid gap-5 md:grid-cols-2">
                                    <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Layer height</p><div className="grid grid-cols-3 rounded-lg border border-slate-200 p-1">{[0.12, 0.16, 0.2].map(value => <button key={value} type="button" onClick={() => setLayerHeight(value)} className={`h-9 rounded-md text-xs font-bold ${layerHeight === value ? 'bg-brand-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{value} mm</button>)}</div></div>
                                    <div><p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Số lớp vỏ</p><div className="flex h-11 items-center rounded-lg border border-slate-200"><button type="button" onClick={() => setWalls(value => Math.max(2, value - 1))} className="h-full w-11 text-slate-500 hover:text-brand-primary"><span className="material-symbols-outlined text-[17px]">remove</span></button><span className="flex-1 text-center text-sm font-extrabold text-slate-800">{walls} walls</span><button type="button" onClick={() => setWalls(value => Math.min(6, value + 1))} className="h-full w-11 text-slate-500 hover:text-brand-primary"><span className="material-symbols-outlined text-[17px]">add</span></button></div></div>
                                </div>
                                <div className="grid gap-5 md:grid-cols-2">
                                    <label><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Infill <strong className="ml-1 text-brand-primary">{infill}%</strong></span><input type="range" min="5" max="60" step="5" value={infill} onChange={event => setInfill(Number(event.target.value))} className="w-full accent-brand-primary" /></label>
                                    <button type="button" onClick={() => setNeedsSupport(value => !value)} className={`flex h-12 items-center justify-between rounded-lg border px-3 text-left ${needsSupport ? 'border-brand-primary bg-brand-soft' : 'border-slate-200 bg-white'}`}><span><span className="block text-xs font-extrabold text-slate-700">Support</span><span className="text-xs text-slate-500">Dùng khi có phần nhô ra</span></span><span className={`material-symbols-outlined text-[21px] ${needsSupport ? 'text-brand-primary' : 'text-slate-300'}`}>{needsSupport ? 'toggle_on' : 'toggle_off'}</span></button>
                                </div>
                            </div>
                        </section>
                    </div>

                    <aside className="print-quote__sidebar space-y-5 xl:sticky xl:top-24">
                        <section className="print-quote__estimate print-quote__card p-5">
                            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-brand-primary">Chi phí</p><h2 className="mt-1 text-xl font-extrabold text-pocket-plum">Chưa thể xác định</h2><p className="mt-1 text-xs text-slate-600">{quantity} sản phẩm · cần đơn giá được xác nhận.</p></div><span className="material-symbols-outlined rounded-xl bg-pocket-butter p-2 text-brand-primary">calculate</span></div>
                            <div className="mt-5 space-y-3 border-y border-brand-light/10 py-4"><QuoteRow label="Khối lượng mô phỏng" value={`${quote.weight.toFixed(1)} g`} /><QuoteRow label="Thời gian mô phỏng / sản phẩm" value={`${quote.hours.toFixed(1)} giờ`} /></div>
                            <div className="mt-4 flex h-11 items-center rounded-xl border border-brand-light/20 bg-white"><button type="button" aria-label="Giảm số lượng" onClick={() => setQuantity(value => Math.max(1, value - 1))} className="h-full w-11 rounded-l-xl text-slate-600 hover:text-brand-primary"><span className="material-symbols-outlined text-[17px]">remove</span></button><span className="flex-1 text-center text-sm font-extrabold text-pocket-plum">{quantity} sản phẩm</span><button type="button" aria-label="Tăng số lượng" onClick={() => setQuantity(value => Math.min(99, value + 1))} className="h-full w-11 rounded-r-xl text-slate-600 hover:text-brand-primary"><span className="material-symbols-outlined text-[17px]">add</span></button></div>
                            <div className="mt-4 rounded-xl border border-pocket-lavender bg-pocket-paper p-3 text-xs leading-relaxed text-slate-700" role="note">Các chỉ số là mô phỏng cục bộ. Đơn giá vật liệu, máy in và hoàn thiện chưa được xác nhận; đây không phải báo giá.</div>
                            <button type="button" onClick={createRequestPreview} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-primary">
                                <span className="material-symbols-outlined text-[18px]">{previewCreated ? 'refresh' : 'visibility'}</span>{previewCreated ? 'Cập nhật bản xem trước' : 'Tạo bản xem trước yêu cầu'}
                            </button>
                            <p className="mt-3 text-center text-xs leading-relaxed text-slate-600">Chưa có API tiếp nhận yêu cầu. Thao tác này không gửi dữ liệu tới máy chủ.</p>
                            {previewCreated && <p className="mt-3 rounded-xl bg-pocket-mint p-3 text-xs font-semibold leading-relaxed text-pocket-plum" role="status">Bản xem trước được tạo trên trang này; chưa gửi tới máy chủ và chưa được kỹ thuật xác nhận.</p>}
                        </section>

                        <section className="print-quote__card p-5">
                            <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pocket-pink text-pocket-plum material-symbols-outlined">lightbulb</span><div><h2 className="font-extrabold text-pocket-plum">Gợi ý cấu hình theo quy tắc</h2><p className="text-xs text-slate-600">Phản hồi tạo cục bộ từ các nhánh quy tắc.</p></div></div>
                            <p className="mt-3 rounded-xl bg-pocket-paper p-3 text-xs leading-relaxed text-slate-700">Không kết nối nhân viên, đội kỹ thuật hoặc AI Backend.</p>
                            <div className="mt-4 max-h-60 space-y-3 overflow-y-auto pr-1">{messages.map(message => <div key={message.id} className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${message.role === 'user' ? 'ml-8 bg-brand-primary text-white' : 'mr-4 bg-pocket-lavender text-pocket-plum'}`}><span className="mb-1 block text-xs font-extrabold">{message.role === 'user' ? 'Bạn' : 'Gợi ý cục bộ'}</span>{message.text}</div>)}</div>
                            <div className="mt-4 flex flex-wrap gap-2">{['Nên chọn chất liệu nào?', 'Có cần support không?', 'Thời gian in bao lâu?'].map(prompt => <button key={prompt} type="button" onClick={() => askAdvisor(prompt)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:border-brand-light/20 hover:text-brand-primary">{prompt}</button>)}</div>
                            <form onSubmit={event => { event.preventDefault(); askAdvisor(); }} className="mt-4 flex gap-2"><input value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="Hỏi về cấu hình in..." className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-primary" /><button type="submit" title="Gửi câu hỏi" className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary text-white"><span className="material-symbols-outlined text-[17px]">send</span></button></form>
                            <p className="mt-3 text-xs leading-relaxed text-slate-500">{materialLabel}. Các gợi ý không thay thế xác nhận kỹ thuật.</p>
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    );
}
