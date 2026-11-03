import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Html } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { getStoredToken } from '../utils/authToken';
import { getViewerModelScale } from '../features/ai-studio/studioPresentation';

/* ─── Preset color swatches ──────────────────────────────── */
const COLOR_PRESETS = [
    { hex: '#f5f0e8', label: 'Trắng ngà' },
    { hex: '#f9a8d4', label: 'Hồng phấn' },
    { hex: '#1d4ed8', label: 'Xanh dương' },
    { hex: '#dc2626', label: 'Đỏ' },
    { hex: '#16a34a', label: 'Xanh lá' },
    { hex: '#f59e0b', label: 'Vàng' },
    { hex: '#7c3aed', label: 'Tím' },
    { hex: '#0e7490', label: 'Xanh cyan' },
    { hex: '#374151', label: 'Xám đậm' },
    { hex: '#1e293b', label: 'Đen' },
];

const STL_PART_CACHE = new WeakMap();
const EMPTY_PARTS = [];
const EMPTY_ROTATION = [0, 0, 0];

function parseDimensionsCm(dimensions) {
    const numbers = String(dimensions || '')
        .match(/\d+(?:[.,]\d+)?/g)
        ?.slice(0, 3)
        .map(value => Number(value.replace(',', '.'))) || [];
    const unit = String(dimensions || '').toLowerCase().includes('cm') ? 1 : 10;
    const fallback = [5, 5, 1];
    return ['x', 'y', 'z'].reduce((result, axis, index) => {
        result[axis] = Number(((numbers[index] || fallback[index] * unit) / unit).toFixed(2));
        return result;
    }, {});
}

function createPartColors(partDefinitions, fallbackColor) {
    return Object.fromEntries(partDefinitions.map(part => [part.id, part.color || fallbackColor]));
}

/* ─── Spinning placeholder cube ─────────────────────────── */
function SpinningCube({ color }) {
    const meshRef = useRef();
    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.4;
            meshRef.current.rotation.x += delta * 0.15;
        }
    });
    return (
        <mesh ref={meshRef} castShadow>
            <boxGeometry args={[1.8, 1.8, 1.8]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
        </mesh>
    );
}

/* ─── STL connected-component splitter ──────────────────── */
function prepareSTLParts(sourceGeometry, shouldSplit) {
    if (shouldSplit && STL_PART_CACHE.has(sourceGeometry)) {
        return STL_PART_CACHE.get(sourceGeometry);
    }
    const source = sourceGeometry.index ? sourceGeometry.toNonIndexed() : sourceGeometry;
    source.computeBoundingBox();

    const overallCenter = new THREE.Vector3();
    const overallSize = new THREE.Vector3();
    source.boundingBox.getCenter(overallCenter);
    source.boundingBox.getSize(overallSize);
    const maxDimension = Math.max(overallSize.x, overallSize.y, overallSize.z) || 1;

    if (!shouldSplit) {
        const geometry = source.clone();
        geometry.translate(-overallCenter.x, -overallCenter.y, -overallCenter.z);
        return {
            baseScale: 3 / maxDimension,
            parts: [{ id: 'part-0', geometry, position: [0, 0, 0] }],
        };
    }

    const positions = source.getAttribute('position');
    const normals = source.getAttribute('normal');
    const parents = [];
    const ranks = [];
    const vertexIds = new Uint32Array(positions.count);
    const vertexLookup = new Map();

    const find = (value) => {
        let root = value;
        while (parents[root] !== root) root = parents[root];
        while (parents[value] !== value) {
            const next = parents[value];
            parents[value] = root;
            value = next;
        }
        return root;
    };

    const union = (left, right) => {
        let leftRoot = find(left);
        let rightRoot = find(right);
        if (leftRoot === rightRoot) return;
        if (ranks[leftRoot] < ranks[rightRoot]) [leftRoot, rightRoot] = [rightRoot, leftRoot];
        parents[rightRoot] = leftRoot;
        if (ranks[leftRoot] === ranks[rightRoot]) ranks[leftRoot] += 1;
    };

    for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        const key = `${x},${y},${z}`;
        let vertexId = vertexLookup.get(key);
        if (vertexId === undefined) {
            vertexId = parents.length;
            vertexLookup.set(key, vertexId);
            parents.push(vertexId);
            ranks.push(0);
        }
        vertexIds[index] = vertexId;

        if (index % 3 === 2) {
            union(vertexIds[index - 2], vertexIds[index - 1]);
            union(vertexIds[index - 1], vertexIds[index]);
        }
    }

    const components = new Map();
    for (let index = 0; index < positions.count; index += 3) {
        const root = find(vertexIds[index]);
        if (!components.has(root)) components.set(root, { positions: [], normals: [] });
        const component = components.get(root);
        for (let offset = 0; offset < 3; offset += 1) {
            const vertexIndex = index + offset;
            component.positions.push(
                positions.getX(vertexIndex),
                positions.getY(vertexIndex),
                positions.getZ(vertexIndex),
            );
            if (normals) {
                component.normals.push(
                    normals.getX(vertexIndex),
                    normals.getY(vertexIndex),
                    normals.getZ(vertexIndex),
                );
            }
        }
    }

    const sortedComponents = [...components.values()].sort((left, right) => right.positions.length - left.positions.length);
    const parts = sortedComponents.map((component, index) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(component.positions, 3));
        if (component.normals.length) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(component.normals, 3));
        } else {
            geometry.computeVertexNormals();
        }
        geometry.computeBoundingBox();
        const partCenter = new THREE.Vector3();
        geometry.boundingBox.getCenter(partCenter);
        geometry.translate(-partCenter.x, -partCenter.y, -partCenter.z);
        return {
            id: `part-${index}`,
            geometry,
            position: [
                partCenter.x - overallCenter.x,
                partCenter.y - overallCenter.y,
                partCenter.z - overallCenter.z,
            ],
        };
    });

    const preparedModel = { baseScale: 3 / maxDimension, parts };
    STL_PART_CACHE.set(sourceGeometry, preparedModel);
    return preparedModel;
}

/* ─── STL Model ──────────────────────────────────────────── */
function STLModel({
    url,
    color,
    customizationMode,
    modelScale,
    partColors,
    partScales,
    selectedPartId,
    onSelectPart,
    onGeometryReady,
    onPartsReady,
}) {
    const configureLoader = useCallback(loader => {
        const token = url.startsWith('/api/') ? getStoredToken() : null;
        loader.setRequestHeader(token ? { Authorization: `Bearer ${token}` } : {});
    }, [url]);
    const geometry = useLoader(STLLoader, url, configureLoader);
    useEffect(() => {
        onGeometryReady?.(geometry);
    }, [geometry, onGeometryReady]);
    const preparedModel = useMemo(
        () => prepareSTLParts(geometry, customizationMode),
        [geometry, customizationMode],
    );
    useEffect(() => {
        onPartsReady?.(preparedModel.parts.map(part => part.id));
    }, [onPartsReady, preparedModel]);

    const overallScale = [
        preparedModel.baseScale * (modelScale.x / 100),
        preparedModel.baseScale * (modelScale.y / 100),
        preparedModel.baseScale * (modelScale.z / 100),
    ];

    return (
        <group scale={overallScale}>
            {preparedModel.parts.map(part => {
                const isSelected = customizationMode && selectedPartId === part.id;
                const partScale = customizationMode ? (partScales[part.id] || 100) / 100 : 1;
                const partColor = customizationMode ? (partColors[part.id] || color) : color;
                return (
                    <group key={part.id} position={part.position} scale={partScale}>
                        <mesh
                            geometry={part.geometry}
                            castShadow
                            receiveShadow
                            onClick={(event) => {
                                if (!customizationMode) return;
                                event.stopPropagation();
                                onSelectPart?.(part.id);
                            }}
                        >
                            <meshStandardMaterial
                                color={partColor}
                                roughness={0.25}
                                metalness={0.35}
                                envMapIntensity={0.8}
                                emissive={isSelected ? partColor : '#000000'}
                                emissiveIntensity={isSelected ? 0.22 : 0}
                            />
                        </mesh>
                    </group>
                );
            })}
        </group>
    );
}

/* ─── GLB named-mesh model ───────────────────────────────── */
function prepareGLBModel(sourceScene) {
    const model = sourceScene.clone(true);
    model.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        if (!child.geometry.getAttribute('normal')) {
            child.geometry = child.geometry.clone();
            child.geometry.computeVertexNormals();
        }
        child.material = Array.isArray(child.material)
            ? child.material.map(material => material.clone())
            : child.material?.clone();
    });

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);
    return { model, baseScale: 3 / (Math.max(size.x, size.y, size.z) || 1) };
}

function GLBModel({
    url,
    color,
    customizationMode,
    modelScale,
    modelRotation,
    partColors,
    selectedPartId,
    onSelectPart,
    onModelReady,
    onPartsReady,
}) {
    const configureLoader = useCallback(loader => {
        const token = url.startsWith('/api/') ? getStoredToken() : null;
        loader.setRequestHeader(token ? { Authorization: `Bearer ${token}` } : {});
    }, [url]);
    const gltf = useLoader(GLTFLoader, url, configureLoader);
    const preparedModel = useMemo(() => prepareGLBModel(gltf.scene), [gltf]);

    useEffect(() => {
        const meshIds = [];
        preparedModel.model.traverse(child => {
            if (child.isMesh && child.name) meshIds.push(child.name);
        });
        onPartsReady?.(meshIds);
        onModelReady?.(preparedModel.model);
    }, [onModelReady, onPartsReady, preparedModel]);

    useEffect(() => {
        const hasNamedCustomParts = Object.keys(partColors).length > 0;
        preparedModel.model.traverse(child => {
            if (!child.isMesh) return;
            const partColor = customizationMode
                ? (partColors[child.name] || (hasNamedCustomParts ? null : color))
                : color;
            const isSelected = customizationMode && selectedPartId === child.name;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(material => {
                if (!material) return;
                if (partColor && material.color) material.color.set(partColor);
                if (material.emissive) {
                    material.emissive.set(isSelected ? partColor : '#000000');
                    material.emissiveIntensity = isSelected ? 0.14 : 0;
                }
                material.needsUpdate = true;
            });
        });
    }, [color, customizationMode, partColors, preparedModel, selectedPartId]);

    const overallScale = [
        preparedModel.baseScale * (modelScale.x / 100),
        preparedModel.baseScale * (modelScale.y / 100),
        preparedModel.baseScale * (modelScale.z / 100),
    ];

    const rotationRadians = modelRotation.map(angle => THREE.MathUtils.degToRad(angle));

    return (
        <group scale={overallScale} rotation={rotationRadians}>
            <primitive
                object={preparedModel.model}
                onClick={event => {
                    if (!customizationMode || !partColors[event.object?.name]) return;
                    event.stopPropagation();
                    onSelectPart?.(event.object.name);
                }}
            />
        </group>
    );
}

/* ─── Loading spinner ────────────────────────────────────── */
function Loader() {
    return (
        <Html center>
            <div className="flex flex-col items-center gap-3 text-white">
                <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold text-teal-200">Đang tải mô hình 3D…</p>
            </div>
        </Html>
    );
}

class ModelErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidUpdate(previousProps) {
        if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="flex h-full w-full items-center justify-center bg-slate-950/85 p-6 text-center text-white">
                <div className="max-w-sm">
                    <span className="material-symbols-outlined text-4xl text-rose-300">deployed_code_alert</span>
                    <p className="mt-3 text-sm font-extrabold">Could not load the 3D model</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                        The generated file is temporarily unavailable. Your generation is still saved.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            this.setState({ error: null });
                            this.props.onRetry();
                        }}
                        className="mt-4 rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold hover:bg-brand-primary"
                    >
                        Retry loading
                    </button>
                </div>
            </div>
        );
    }
}

/* ─── Main exported component ────────────────────────────── */
export default function ThreeDViewer({
    modelUrl,
    stlUrl,
    imgSrc,
    modelColor = '#a78bfa',
    dimensions,
    modelRotation = EMPTY_ROTATION,
    partDefinitions = EMPTY_PARTS,
    onEditModel,
    presentationMode = false,
    fixedExportFormat,
    allowColorCustomization = true,
    allowDimensionCustomization = true,
    allowSegmentedCustomization = true,
    allowDownload = true,
    onBeforeDownload,
    maxModelDimensionMm,
    externalPartColors,
    externalSelectedPartId,
    externalModelScale,
    onCustomizationChange,
}) {
    const resolvedModelUrl = modelUrl || stlUrl;
    const isGLBModel = /\.glb(?:$|[?#])/i.test(resolvedModelUrl || '');
    const hasModel = Boolean(resolvedModelUrl);
    const baseDimensionsCm = useMemo(() => parseDimensionsCm(dimensions), [dimensions]);
    const partCustomizationEnabled = allowSegmentedCustomization && partDefinitions.length > 1;
    const [activeColor, setActiveColor] = useState(modelColor);
    const [customColor, setCustomColor] = useState(modelColor);
    const [activePanel, setActivePanel] = useState(null);
    const [productDimensions, setProductDimensions] = useState(baseDimensionsCm);
    const [lockProportions, setLockProportions] = useState(true);
    const [exportFormat, setExportFormat] = useState('stl');
    const [sourceGeometry, setSourceGeometry] = useState(null);
    const [sourceModel, setSourceModel] = useState(null);
    const [detectedPartIds, setDetectedPartIds] = useState([]);
    const [selectedPartId, setSelectedPartId] = useState(partDefinitions[0]?.id || null);
    const [partColors, setPartColors] = useState(() => createPartColors(partDefinitions, modelColor));
    const [exportStatus, setExportStatus] = useState('');
    const [editPrompt, setEditPrompt] = useState('');
    const [referenceImage, setReferenceImage] = useState(null);
    const [editMode, setEditMode] = useState('text');
    const [loadAttempt, setLoadAttempt] = useState(0);
    const loaderModelUrl = useMemo(() => {
        if (!resolvedModelUrl || loadAttempt === 0) return resolvedModelUrl;
        const separator = resolvedModelUrl.includes('?') ? '&' : '?';
        return `${resolvedModelUrl}${separator}retry=${loadAttempt}`;
    }, [loadAttempt, resolvedModelUrl]);

    const customParts = partDefinitions.filter(part => !detectedPartIds.length || detectedPartIds.includes(part.id));
    const selectedPart = customParts.find(part => part.id === selectedPartId) || customParts[0];
    const displayedColor = partCustomizationEnabled && selectedPart
        ? (partColors[selectedPart.id] || activeColor)
        : activeColor;
    const modelScale = getViewerModelScale(baseDimensionsCm, productDimensions)
        || { x: 100, y: 100, z: 100 };

    function emitCustomizationChange(overrides = {}) {
        const customization = {
            partColors: overrides.partColors ?? partColors,
            modelScale: overrides.modelScale ?? modelScale,
        };
        if (Object.hasOwn(overrides, 'modelColor')) customization.modelColor = overrides.modelColor;
        onCustomizationChange?.(customization);
    }

    function selectPart(partId) {
        setSelectedPartId(partId);
        setCustomColor(partColors[partId] || activeColor);
    }

    function resetProductDimensions() {
        setProductDimensions(baseDimensionsCm);
        emitCustomizationChange({ modelScale: getViewerModelScale(baseDimensionsCm, baseDimensionsCm) });
    }

    useEffect(() => {
        setSourceGeometry(null);
        setSourceModel(null);
        setExportStatus('');
        setExportFormat(isGLBModel ? 'glb' : 'stl');
    }, [isGLBModel, resolvedModelUrl]);

    useEffect(() => {
        if (fixedExportFormat) setExportFormat(fixedExportFormat);
    }, [fixedExportFormat]);

    useEffect(() => {
        if (!allowDownload && activePanel === 'download') setActivePanel(null);
    }, [activePanel, allowDownload]);

    useEffect(() => {
        setProductDimensions(baseDimensionsCm);
    }, [baseDimensionsCm, resolvedModelUrl]);

    useEffect(() => {
        setActiveColor(modelColor);
        setCustomColor(modelColor);
        setSelectedPartId(partDefinitions[0]?.id || null);
        setPartColors(createPartColors(partDefinitions, modelColor));
    }, [modelColor, partDefinitions, resolvedModelUrl]);

    // Sync external overrides from parent (e.g. AIStudioPage customization panel)
    useEffect(() => {
        if (externalPartColors) setPartColors(externalPartColors);
    }, [externalPartColors]);

    useEffect(() => {
        if (externalSelectedPartId != null) setSelectedPartId(externalSelectedPartId);
    }, [externalSelectedPartId]);

    useEffect(() => {
        if (externalModelScale) {
            const base = baseDimensionsCm;
            setProductDimensions({
                x: Number((base.x * externalModelScale.x / 100).toFixed(2)),
                y: Number((base.y * externalModelScale.y / 100).toFixed(2)),
                z: Number((base.z * externalModelScale.z / 100).toFixed(2)),
            });
        }
    }, [externalModelScale, baseDimensionsCm]);

    function handlePreset(hex) {
        if (partCustomizationEnabled && selectedPart) {
            const nextPartColors = { ...partColors, [selectedPart.id]: hex };
            setPartColors(nextPartColors);
            emitCustomizationChange({ partColors: nextPartColors });
        } else {
            setActiveColor(hex);
            emitCustomizationChange({ modelColor: hex });
        }
        setCustomColor(hex);
    }

    function handleCustomInput(e) {
        setCustomColor(e.target.value);
        if (partCustomizationEnabled && selectedPart) {
            const nextPartColors = { ...partColors, [selectedPart.id]: e.target.value };
            setPartColors(nextPartColors);
            emitCustomizationChange({ partColors: nextPartColors });
        } else {
            setActiveColor(e.target.value);
            emitCustomizationChange({ modelColor: e.target.value });
        }
    }

    function togglePanel(panel) {
        if (panel === 'color' && !allowColorCustomization) return;
        if (panel === 'size' && !allowDimensionCustomization) return;
        if (panel === 'download' && !allowDownload) return;
        setActivePanel(current => current === panel ? null : panel);
        if (panel === 'edit') setEditMode('text');
        setExportStatus('');
    }

    function handleReferenceImage(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
            setExportStatus('Ảnh tham chiếu phải nhỏ hơn 3 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => setReferenceImage(reader.result);
        reader.readAsDataURL(file);
    }

    function requestAiEdit() {
        if (!editPrompt.trim() && !referenceImage) {
            setExportStatus('Nhập mô tả hoặc chọn ảnh tham chiếu.');
            return;
        }
        onEditModel?.({ prompt: editPrompt.trim(), imageDataUrl: referenceImage });
        setActivePanel(null);
    }

    function maxDimensionCm(axis) {
        const modelLimit = Math.max(baseDimensionsCm[axis] * 3, 0.5);
        const machineLimit = Number(maxModelDimensionMm) > 0
            ? Number(maxModelDimensionMm) / 10
            : Number.POSITIVE_INFINITY;
        return Math.min(modelLimit, machineLimit);
    }

    function updateProductDimension(axis, value) {
        const maxDimension = maxDimensionCm(axis);
        const nextValue = Math.max(0.1, Math.min(maxDimension, Number(value) || 0.1));
        let nextDimensions;
        if (!lockProportions) {
            nextDimensions = { ...productDimensions, [axis]: nextValue };
        } else {
            const requestedMultiplier = nextValue / baseDimensionsCm[axis];
            const maximumMultiplier = Math.min(...['x', 'y', 'z'].map(key => (
                maxDimensionCm(key) / baseDimensionsCm[key]
            )));
            const multiplier = Math.min(requestedMultiplier, maximumMultiplier);
            nextDimensions = Object.fromEntries(['x', 'y', 'z'].map(key => (
                [key, Number((baseDimensionsCm[key] * multiplier).toFixed(2))]
            )));
        }
        setProductDimensions(nextDimensions);
        emitCustomizationChange({ modelScale: getViewerModelScale(baseDimensionsCm, nextDimensions) });
    }

    function downloadBlob(file, type, extension) {
        const blob = new Blob([file], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `custom-keychain.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        setExportStatus(`Đã tải file ${extension.toUpperCase()}.`);
    }

    function createExportModel() {
        const model = new THREE.Group();
        const parts = prepareSTLParts(sourceGeometry, partCustomizationEnabled).parts;
        parts.forEach(part => {
            const mesh = new THREE.Mesh(
                part.geometry.clone(),
                new THREE.MeshStandardMaterial({ color: partCustomizationEnabled ? (partColors[part.id] || activeColor) : activeColor }),
            );
            mesh.position.fromArray(part.position);
            model.add(mesh);
        });
        model.scale.set(modelScale.x / 100, modelScale.y / 100, modelScale.z / 100);
        model.updateMatrixWorld(true);
        return model;
    }

    function createGLBExportModel() {
        const model = sourceModel.clone(true);
        model.scale.set(modelScale.x / 100, modelScale.y / 100, modelScale.z / 100);
        model.updateMatrixWorld(true);
        return model;
    }

    async function handleDownload() {
        if (!allowDownload) return;
        try {
            await onBeforeDownload?.();
        } catch (error) {
            setExportStatus(error.response?.data?.message || error.message || 'Không thể xác nhận lượt tải.');
            return;
        }
        if (isGLBModel) {
            if (!sourceModel) {
                setExportStatus('Đang tải mô hình, thử lại sau giây lát.');
                return;
            }
            const model = createGLBExportModel();
            if (exportFormat === 'stl') {
                downloadBlob(new STLExporter().parse(model, { binary: true }), 'application/sla', 'stl');
                return;
            }
            new GLTFExporter().parse(
                model,
                result => downloadBlob(result, 'model/gltf-binary', 'glb'),
                error => setExportStatus(`Không thể xuất GLB: ${error.message}`),
                { binary: true },
            );
            return;
        }

        if (!sourceGeometry) {
            setExportStatus('Đang tải mô hình, thử lại sau giây lát.');
            return;
        }

        const model = createExportModel();
        if (exportFormat === 'stl') {
            downloadBlob(new STLExporter().parse(model, { binary: true }), 'application/sla', 'stl');
            return;
        }
        if (exportFormat === 'obj') {
            downloadBlob(new OBJExporter().parse(model), 'text/plain', 'obj');
            return;
        }
        if (exportFormat === 'glb') {
            new GLTFExporter().parse(
                model,
                result => downloadBlob(result, 'model/gltf-binary', 'glb'),
                error => setExportStatus(`Không thể xuất GLB: ${error.message}`),
                { binary: true },
            );
            return;
        }
        try {
            const archive = await new USDZExporter().parse(model);
            downloadBlob(archive, 'model/vnd.usdz+zip', 'usdz');
        } catch (error) {
            setExportStatus(`Không thể xuất USDZ: ${error.message}`);
        }
    }

    return (
        <div className="w-full h-full relative overflow-hidden rounded-2xl border border-white/25 bg-slate-950/15 backdrop-blur-sm">

            {/* Controls hint */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 text-xs text-white/60 font-medium pointer-events-none">
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">mouse</span>
                    Kéo để xoay
                </span>
                <span className="w-px h-3 bg-white/20" />
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">scroll</span>
                    Cuộn để zoom
                </span>
                <span className="w-px h-3 bg-white/20" />
                <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">pan_tool</span>
                    Chuột phải để pan
                </span>
            </div>

            {/* 3D badge */}
            <div className="absolute top-3 right-3 z-10 bg-brand-primary/80 backdrop-blur text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>view_in_ar</span>
                3D
            </div>

            {/* ── Color picker panel ── */}
            <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-20 ${presentationMode ? 'hidden' : ''}`}>
                <div className="flex flex-col items-center gap-2">

                    {/* Expanded picker */}
                    {activePanel && (activePanel !== 'download' || allowDownload) && (
                        <div className="w-[min(360px,calc(100vw-40px))] max-h-[calc(100vh-48px)] overflow-y-auto bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl p-3 shadow-xl flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs text-white/50 font-semibold uppercase tracking-widest">Tùy chỉnh sản phẩm</p>
                                <button
                                    type="button"
                                    onClick={resetProductDimensions}
                                    className="text-xs font-bold text-teal-200 hover:text-white transition-colors"
                                >
                                    Đặt lại kích thước
                                </button>
                            </div>

                            {/* Preset swatches */}
                            <div>
                                <p className="mb-1.5 text-xs font-semibold text-white/60">Màu sắc</p>
                                {partCustomizationEnabled && (
                                    <div className="mb-2 grid grid-cols-2 gap-1.5">
                                        {customParts.map(part => (
                                            <button
                                                key={part.id}
                                                type="button"
                                                onClick={() => {
                                                    selectPart(part.id);
                                                }}
                                                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-bold transition-colors ${selectedPart?.id === part.id ? 'border-brand-primary bg-brand-primary/20 text-white' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}
                                            >
                                                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/40" style={{ backgroundColor: partColors[part.id] || activeColor }} />
                                                <span className="truncate">{part.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div className="grid grid-cols-10 gap-1.5">
                                    {COLOR_PRESETS.map(({ hex, label }) => (
                                        <button
                                            key={hex}
                                            title={label}
                                            onClick={() => handlePreset(hex)}
                                            className="relative h-6 w-6 rounded-full border-2 transition-all duration-150 hover:scale-110 focus:outline-none"
                                            style={{
                                                backgroundColor: hex,
                                                borderColor: displayedColor === hex ? '#fff' : 'transparent',
                                                boxShadow: displayedColor === hex ? `0 0 0 2px ${hex}80` : 'none',
                                            }}
                                        >
                                            {displayedColor === hex && (
                                                <span className="material-symbols-outlined text-[12px] absolute inset-0 flex items-center justify-center text-white drop-shadow" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Custom color input */}
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 w-full">
                                <input
                                    type="color"
                                    value={displayedColor}
                                    onChange={handleCustomInput}
                                    className="w-5 h-5 rounded-full cursor-pointer bg-transparent border-none outline-none"
                                    style={{ appearance: 'none', padding: 0 }}
                                />
                                <span className="text-xs text-white/60 font-mono flex-1">{displayedColor.toUpperCase()}</span>
                                <span className="text-xs text-white/40">Tuỳ chỉnh</span>
                            </div>

                            <div className="border-t border-white/10 pt-3">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <p className="text-xs font-semibold text-white/60">Kích thước</p>
                                    <button
                                        type="button"
                                        onClick={() => setLockProportions(value => !value)}
                                        title={lockProportions ? 'Giữ tỉ lệ' : 'Chỉnh từng chiều'}
                                        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${lockProportions ? 'bg-brand-primary text-white' : 'bg-white/10 text-white/50'}`}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">{lockProportions ? 'lock' : 'lock_open'}</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {['x', 'y', 'z'].map(axis => (
                                        <label key={axis} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center">
                                            <span className="block text-xs font-bold uppercase text-white/40">{axis}</span>
                                            <span className="mt-0.5 flex items-center justify-center gap-0.5">
                                                <input
                                                    type="number"
                                                    min="0.1"
                                                    max={maxDimensionCm(axis)}
                                                    step="0.1"
                                                    value={productDimensions[axis]}
                                                    onChange={event => updateProductDimension(axis, event.target.value)}
                                                    className="w-10 bg-transparent text-right text-xs font-bold text-white outline-none"
                                                />
                                                <span className="text-xs text-white/40">cm</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {allowDownload && <div className="border-t border-white/10 pt-3">
                                <p className="mb-1.5 text-xs font-semibold text-white/60">Tải mô hình</p>
                                <div className="flex gap-2">
                                    <select
                                        value={exportFormat}
                                        onChange={event => setExportFormat(event.target.value)}
                                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/10 px-2 py-2 text-xs font-bold text-white outline-none"
                                    >
                                        {isGLBModel ? (
                                            <option value="glb" className="text-slate-900">GLB</option>
                                        ) : (
                                            <>
                                                <option value="stl" className="text-slate-900">STL</option>
                                                <option value="obj" className="text-slate-900">OBJ</option>
                                                <option value="glb" className="text-slate-900">GLB</option>
                                                <option value="usdz" className="text-slate-900">USDZ</option>
                                            </>
                                        )}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleDownload}
                                        disabled={!hasModel || (isGLBModel ? !sourceModel : !sourceGeometry)}
                                        className="flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-[15px]">download</span>
                                        Tải về
                                    </button>
                                </div>
                                {exportStatus && <p className="mt-1.5 text-xs text-teal-100">{exportStatus}</p>}
                            </div>}
                        </div>
                    )}

                    {activePanel && (activePanel !== 'download' || allowDownload) && (
                        <div className="absolute bottom-14 left-1/2 w-[min(360px,calc(100vw-40px))] max-h-[calc(100vh-120px)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-xl backdrop-blur-md">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                                    {activePanel === 'color' && 'Màu từng chi tiết'}
                                    {activePanel === 'size' && 'Kích thước'}
                                    {activePanel === 'download' && 'Tải mô hình'}
                                    {activePanel === 'edit' && 'Chỉnh bằng AI'}
                                    {activePanel === 'text' && 'Chỉnh bằng văn bản'}
                                    {activePanel === 'image' && 'Chỉnh bằng ảnh'}
                                </p>
                                <button type="button" onClick={() => setActivePanel(null)} title="Đóng" className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white">
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>

                            {activePanel === 'color' && allowColorCustomization && (
                                <div className="space-y-3">
                                    {partCustomizationEnabled && (
                                        <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                                            <p className="mb-2 text-xs font-semibold text-white/60">Chọn một mảnh bên dưới hoặc click trực tiếp trên mô hình</p>
                                            <div className="grid grid-cols-2 gap-1.5">
                                            {customParts.map(part => (
                                                <button
                                                    key={part.id}
                                                    type="button"
                                                    onClick={() => {
                                                        selectPart(part.id);
                                                    }}
                                                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-bold transition-colors ${selectedPart?.id === part.id ? 'border-brand-primary bg-brand-primary/20 text-white' : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'}`}
                                                >
                                                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/40" style={{ backgroundColor: partColors[part.id] || activeColor }} />
                                                    <span className="truncate">{part.name}</span>
                                                </button>
                                            ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-10 gap-1.5">
                                        {COLOR_PRESETS.map(({ hex, label }) => (
                                            <button
                                                key={hex}
                                                type="button"
                                                title={label}
                                                onClick={() => handlePreset(hex)}
                                                className="relative h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                                                style={{
                                                    backgroundColor: hex,
                                                    borderColor: displayedColor === hex ? '#fff' : 'transparent',
                                                    boxShadow: displayedColor === hex ? `0 0 0 2px ${hex}80` : 'none',
                                                }}
                                            >
                                                {displayedColor === hex && <span className="material-symbols-outlined absolute inset-0 flex items-center justify-center text-[12px] text-white drop-shadow">check</span>}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5">
                                        <input type="color" value={displayedColor} onChange={handleCustomInput} className="h-5 w-5 cursor-pointer border-none bg-transparent p-0" />
                                        <span className="flex-1 font-mono text-xs text-white/60">{displayedColor.toUpperCase()}</span>
                                    </label>
                                </div>
                            )}

                            {activePanel === 'size' && allowDimensionCustomization && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-white/60">Đơn vị cm</p>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={resetProductDimensions} title="Đặt lại kích thước" className="text-xs font-bold text-teal-200 hover:text-white">Đặt lại</button>
                                            <button type="button" onClick={() => setLockProportions(value => !value)} title={lockProportions ? 'Giữ tỉ lệ' : 'Chỉnh từng chiều'} className={`flex h-7 w-7 items-center justify-center rounded-lg ${lockProportions ? 'bg-brand-primary text-white' : 'bg-white/10 text-white/50'}`}>
                                                <span className="material-symbols-outlined text-[15px]">{lockProportions ? 'lock' : 'lock_open'}</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['x', 'y', 'z'].map(axis => (
                                            <label key={axis} className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
                                                <span className="block text-xs font-bold uppercase text-white/40">{axis}</span>
                                                <span className="mt-1 flex items-center justify-center gap-0.5">
                                                    <input type="number" min="0.1" max={maxDimensionCm(axis)} step="0.1" value={productDimensions[axis]} onChange={event => updateProductDimension(axis, event.target.value)} className="w-10 bg-transparent text-right text-xs font-bold text-white outline-none" />
                                                    <span className="text-xs text-white/40">cm</span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="space-y-2 border-t border-white/10 pt-3">
                                        {['x', 'y', 'z'].map(axis => (
                                            <label key={axis} className="flex items-center gap-2 text-xs text-white/60">
                                                <span className="w-3 font-bold uppercase">{axis}</span>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max={maxDimensionCm(axis)}
                                                    step="0.1"
                                                    value={productDimensions[axis]}
                                                    onChange={event => updateProductDimension(axis, event.target.value)}
                                                    className="h-1.5 flex-1 cursor-pointer accent-brand-primary"
                                                />
                                                <span className="w-12 text-right font-mono text-white/80">{productDimensions[axis]} cm</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activePanel === 'download' && allowDownload && (
                                <div className="space-y-2">
                                    <select value={exportFormat} onChange={event => setExportFormat(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2.5 text-[12px] font-bold text-white outline-none">
                                        {isGLBModel ? (
                                            <option value="glb" className="text-slate-900">GLB</option>
                                        ) : (
                                            <>
                                                <option value="stl" className="text-slate-900">STL</option>
                                                <option value="obj" className="text-slate-900">OBJ</option>
                                                <option value="glb" className="text-slate-900">GLB</option>
                                                <option value="usdz" className="text-slate-900">USDZ</option>
                                            </>
                                        )}
                                    </select>
                                    <button type="button" onClick={handleDownload} disabled={!hasModel || (isGLBModel ? !sourceModel : !sourceGeometry)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-2.5 text-[12px] font-bold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50">
                                        <span className="material-symbols-outlined text-[17px]">download</span>
                                        Tải về
                                    </button>
                                </div>
                            )}

                            {activePanel === 'edit' && (
                                <div className="mb-3 grid grid-cols-2 rounded-xl bg-white/5 p-1">
                                    <button type="button" onClick={() => setEditMode('text')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${editMode === 'text' ? 'bg-brand-primary text-white' : 'text-white/50 hover:text-white'}`}>
                                        <span className="material-symbols-outlined text-[15px]">text_fields</span>
                                        Văn bản
                                    </button>
                                    <button type="button" onClick={() => setEditMode('image')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${editMode === 'image' ? 'bg-brand-primary text-white' : 'text-white/50 hover:text-white'}`}>
                                        <span className="material-symbols-outlined text-[15px]">add_photo_alternate</span>
                                        Hình ảnh
                                    </button>
                                </div>
                            )}

                            {activePanel === 'edit' && editMode === 'text' && (
                                <div className="space-y-2">
                                    <textarea value={editPrompt} onChange={event => setEditPrompt(event.target.value)} placeholder="Mô tả thay đổi cho mô hình..." className="h-24 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white outline-none placeholder:text-white/35 focus:border-brand-primary" />
                                    <button type="button" onClick={requestAiEdit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-2.5 text-[12px] font-bold text-white hover:bg-brand-hover">
                                        <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
                                        Chỉnh trong AI Studio
                                    </button>
                                </div>
                            )}

                            {activePanel === 'edit' && editMode === 'image' && (
                                <div className="space-y-2">
                                    <label className="flex min-h-24 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-white/5 hover:border-brand-light">
                                        {referenceImage ? <img src={referenceImage} alt="Ảnh tham chiếu" className="h-24 w-full object-cover" /> : <span className="material-symbols-outlined text-[28px] text-white/50">add_photo_alternate</span>}
                                        <input type="file" accept="image/*" onChange={handleReferenceImage} className="hidden" />
                                    </label>
                                    <button type="button" onClick={requestAiEdit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-primary py-2.5 text-[12px] font-bold text-white hover:bg-brand-hover">
                                        <span className="material-symbols-outlined text-[17px]">auto_awesome</span>
                                        Chỉnh trong AI Studio
                                    </button>
                                </div>
                            )}

                            {exportStatus && <p className="mt-2 text-xs text-teal-100">{exportStatus}</p>}
                        </div>
                    )}

                    <div className="flex items-center gap-1 rounded-xl border border-white/15 bg-slate-950/85 p-1.5 shadow-lg backdrop-blur">
                        {[
                            { id: 'color', icon: 'palette', label: 'Tùy chỉnh màu' },
                            { id: 'size', icon: 'straighten', label: 'Tùy chỉnh kích thước' },
                            { id: 'edit', icon: 'auto_awesome', label: 'Chỉnh bằng văn bản hoặc ảnh' },
                            { id: 'download', icon: 'download', label: 'Tải mô hình' },
                        ].filter(tool => (
                            (tool.id !== 'color' || allowColorCustomization)
                            && (tool.id !== 'size' || allowDimensionCustomization)
                            && (tool.id !== 'download' || allowDownload)
                        )).map(tool => (
                            <button
                                key={tool.id}
                                type="button"
                                title={tool.label}
                                aria-label={tool.label}
                                onClick={() => togglePanel(tool.id)}
                                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${activePanel === tool.id ? 'bg-brand-primary text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
                            >
                                <span className="material-symbols-outlined text-[18px]">{tool.icon}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {presentationMode && allowDownload && (
                <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={!hasModel || (isGLBModel ? !sourceModel : !sourceGeometry)}
                        className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-slate-950/85 px-4 text-xs font-extrabold text-white shadow-lg backdrop-blur transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-[17px]">download</span>
                        Xuất {exportFormat.toUpperCase()}
                    </button>
                    {exportStatus && <p className="mt-2 rounded-md bg-slate-950/85 px-2 py-1 text-center text-xs text-teal-100">{exportStatus}</p>}
                </div>
            )}

            {/* Canvas */}
            <ModelErrorBoundary
                resetKey={`${resolvedModelUrl || 'empty'}:${loadAttempt}`}
                onRetry={() => setLoadAttempt(current => current + 1)}
            >
            <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
                shadows
                gl={{ antialias: true, alpha: true }}
            >
                {/* Lighting */}
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
                <directionalLight position={[-5, -3, -5]} intensity={0.4} color="#818cf8" />
                <pointLight position={[0, 5, 0]} intensity={0.5} color="#c4b5fd" />

                {/* Environment */}
                <Environment preset="city" />

                {/* Model or fallback */}
                <Suspense fallback={<Loader />}>
                    {hasModel
                        ? (
                            isGLBModel ? (
                                <GLBModel
                                    url={loaderModelUrl}
                                    color={activeColor}
                                    customizationMode={partCustomizationEnabled}
                                    modelScale={modelScale}
                                    modelRotation={modelRotation}
                                    partColors={partColors}
                                    selectedPartId={presentationMode ? null : selectedPartId}
                                    onSelectPart={presentationMode ? undefined : selectPart}
                                    onModelReady={setSourceModel}
                                    onPartsReady={setDetectedPartIds}
                                />
                            ) : (
                                <STLModel
                                    url={loaderModelUrl}
                                    color={activeColor}
                                    customizationMode={partCustomizationEnabled}
                                    modelScale={modelScale}
                                    partColors={partColors}
                                    partScales={{}}
                                    selectedPartId={presentationMode ? null : selectedPartId}
                                    onSelectPart={presentationMode ? undefined : selectPart}
                                    onGeometryReady={setSourceGeometry}
                                    onPartsReady={setDetectedPartIds}
                                />
                            )
                        )
                        : <SpinningCube color={activeColor} />
                    }
                    <ContactShadows
                        position={[0, -2, 0]}
                        opacity={0.4}
                        scale={8}
                        blur={2.5}
                        far={4}
                    />
                </Suspense>

                {/* Orbit controls */}
                <OrbitControls
                    enableDamping={!presentationMode}
                    dampingFactor={0.08}
                    minDistance={2}
                    maxDistance={10}
                    enablePan={!presentationMode}
                    enableRotate={!presentationMode}
                    enableZoom={!presentationMode}
                    autoRotate={presentationMode || !partCustomizationEnabled}
                    autoRotateSpeed={1.2}
                />
            </Canvas>
            </ModelErrorBoundary>
        </div>
    );
}
