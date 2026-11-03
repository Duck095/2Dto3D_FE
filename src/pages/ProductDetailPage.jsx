import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { STORE_PRODUCTS, PRODUCT_COLLECTIONS } from '../data/productModels';
import ProductCard from '../components/storefront/ProductCard';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
    findPublicProduct,
    getApprovedProductMedia,
    getPublicProducts,
    resolveStorefrontPricing,
} from '../features/storefront/productPresentation';
import { consumeCommunityDownload } from '../services/membershipService';
import './product-detail.css';

const EMPTY_MEDIA = { images: [], videoUrl: null, modelUrl: null };
const ThreeDViewer = lazy(() => import('../components/ThreeDViewer'));

function UnavailableProduct() {
    return (
        <div className="joy-detail joy-detail--unavailable">
            <div className="joy-detail__unavailable-card">
                <span className="joy-detail__doodle" aria-hidden="true">✳</span>
                <span className="joy-detail__kicker">A LITTLE PAUSE</span>
                <h1>Sản phẩm này chưa khả dụng</h1>
                <p>Món đồ bạn tìm hiện chưa nằm trong bộ sưu tập được công khai.</p>
                <Link to="/marketplace" className="joy-detail__button joy-detail__button--primary">Khám phá cửa hàng</Link>
            </div>
        </div>
    );
}

function initialChoiceId(choices) {
    if (!Array.isArray(choices) || choices.length === 0) return '';
    if (choices.length === 1) return String(choices[0].id);
    const defaults = choices.filter(choice => choice.isDefault === true);
    return defaults.length === 1 ? String(defaults[0].id) : '';
}

function Price({ pricing }) {
    if (pricing.priceLabel) return <strong className="joy-detail__price">{pricing.priceLabel}</strong>;
    if (pricing.status === 'option-required') return <span className="joy-detail__price-note">Chọn phiên bản để xem giá</span>;
    if (pricing.status === 'material-required') return <span className="joy-detail__price-note">Chọn chất liệu để xem giá</span>;
    return <span className="joy-detail__price-note">Giá chưa được xác nhận cho lựa chọn này</span>;
}

export default function ProductDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addItem } = useCart();
    const { membership, isAuthenticated, updateMembership } = useAuth();
    const product = findPublicProduct(STORE_PRODUCTS, id);
    const media = product ? getApprovedProductMedia(product) : EMPTY_MEDIA;
    const purchaseOptions = Array.isArray(product?.purchaseOptions) ? product.purchaseOptions : [];
    const materials = Array.isArray(product?.materials) ? product.materials : [];
    const related = useMemo(() => {
        if (!product) return [];
        const productCollections = Array.isArray(product.collections) ? product.collections : [];
        return getPublicProducts(STORE_PRODUCTS)
            .filter(item => item.id !== product.id && item.collections?.some(collection => productCollections.includes(collection)))
            .slice(0, 4);
    }, [product]);

    const [activeImage, setActiveImage] = useState(0);
    const [activeMedia, setActiveMedia] = useState('image');
    const [quantity, setQuantity] = useState(1);
    const [selectedOptionId, setSelectedOptionId] = useState('');
    const [selectedMaterialId, setSelectedMaterialId] = useState('');

    useEffect(() => {
        setActiveImage(0);
        setActiveMedia('image');
        setQuantity(1);
        setSelectedOptionId(initialChoiceId(purchaseOptions));
        setSelectedMaterialId(initialChoiceId(materials));
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }, [id, product?.id]);

    if (!product) return <UnavailableProduct />;

    const collectionNames = PRODUCT_COLLECTIONS
        .filter(collection => product.collections?.includes(collection.id))
        .map(collection => collection.title);
    const reviews = Array.isArray(product.verifiedReviews) ? product.verifiedReviews : [];
    const publicDetails = Array.isArray(product.publicDetails) ? product.publicDetails : [];
    const selectedOption = purchaseOptions.find(option => String(option.id) === String(selectedOptionId));
    const selectedMaterial = materials.find(material => String(material.id) === String(selectedMaterialId));
    const pricing = resolveStorefrontPricing(product, { option: selectedOption, material: selectedMaterial });
    const activeImageUrl = media.images[activeImage] || media.images[0] || '';

    async function authorizeModelDownload() {
        if (!isAuthenticated) throw new Error('Đăng nhập để tải mẫu cộng đồng.');
        const nextMembership = await consumeCommunityDownload(String(product.id));
        updateMembership(nextMembership);
    }

    function openAiEditor() {
        navigate('/studio', {
            state: {
                modelEditDraft: {
                    title: product.title,
                    imageDataUrl: media.images[0] || null,
                    modelUrl: media.modelUrl,
                    parts: product.publicModelParts || [],
                },
            },
        });
    }

    function addCurrentItem() {
        addItem(product, { option: selectedOption, material: selectedMaterial, quantity });
    }

    return (
        <div className="joy-detail">
            <nav className="joy-detail__breadcrumbs" aria-label="Đường dẫn">
                <Link to="/">Trang chủ</Link><span aria-hidden="true">/</span>
                <Link to="/marketplace">Cửa hàng</Link><span aria-hidden="true">/</span>
                <span aria-current="page">{product.title}</span>
            </nav>

            <section className="joy-detail__top">
                <div className="joy-detail__gallery">
                    <div className="joy-detail__stage">
                        {activeMedia === 'model' && media.modelUrl ? (
                            <div className="joy-detail__model-viewer">
                                <Suspense fallback={<p className="joy-detail__loading">Đang tải bản xem trước 3D…</p>}>
                                    <ThreeDViewer
                                        modelUrl={media.modelUrl}
                                        imgSrc={activeImageUrl || undefined}
                                        modelColor={product.publicModelColor || '#d991ad'}
                                        dimensions={product.publicModelDimensions}
                                        partDefinitions={product.publicModelParts}
                                        onEditModel={openAiEditor}
                                        allowColorCustomization={membership?.colorCustomizationAllowed === true}
                                        allowDimensionCustomization={membership?.dimensionCustomizationAllowed === true}
                                        allowSegmentedCustomization={membership?.segmentedModelsAllowed === true}
                                        allowDownload={Boolean(isAuthenticated && (membership?.unlimitedCommunityDownloads || (membership?.communityDownloadsRemaining || 0) > 0))}
                                        onBeforeDownload={authorizeModelDownload}
                                        maxModelDimensionMm={membership?.maxModelDimensionMm}
                                    />
                                </Suspense>
                            </div>
                        ) : activeMedia === 'video' && media.videoUrl ? (
                            <video className="joy-detail__video" src={media.videoUrl} controls playsInline preload="metadata" aria-label={'Video sản phẩm ' + product.title} />
                        ) : activeImageUrl ? (
                            <img className="joy-detail__main-image" src={activeImageUrl} alt={product.title} fetchPriority="high" />
                        ) : (
                            <div className="joy-detail__media-empty" role="status">
                                <span aria-hidden="true">✳</span>
                                <strong>Ảnh sản phẩm sẽ được cập nhật</strong>
                                <small>Chỉ hiển thị tư liệu đã được cấp quyền.</small>
                            </div>
                        )}
                    </div>

                    {(media.images.length > 1 || media.videoUrl || media.modelUrl) && <div className="joy-detail__media-controls" aria-label="Tư liệu sản phẩm">
                        {media.images.map((image, index) => (
                            <button
                                type="button"
                                key={image}
                                aria-label={'Xem ảnh ' + (index + 1)}
                                aria-pressed={activeMedia === 'image' && activeImage === index}
                                className={activeMedia === 'image' && activeImage === index ? 'is-active' : ''}
                                onClick={() => { setActiveMedia('image'); setActiveImage(index); }}
                            ><img src={image} alt="" loading="lazy" /></button>
                        ))}
                        {media.videoUrl && <button
                            type="button"
                            aria-pressed={activeMedia === 'video'}
                            className={'joy-detail__media-chip' + (activeMedia === 'video' ? ' is-active' : '')}
                            onClick={() => setActiveMedia('video')}
                        >Video thật</button>}
                        {media.modelUrl && <button
                            type="button"
                            aria-pressed={activeMedia === 'model'}
                            className={'joy-detail__media-chip' + (activeMedia === 'model' ? ' is-active' : '')}
                            onClick={() => setActiveMedia('model')}
                        >Xem 3D <span>tùy chọn</span></button>}
                    </div>}
                    <p className="joy-detail__media-note">3D là tính năng xem thêm; hình ảnh sản phẩm là phần chính.</p>
                </div>

                <div className="joy-detail__summary">
                    <div className="joy-detail__eyebrows">
                        {collectionNames.map(name => <span key={name}>{name}</span>)}
                    </div>
                    <span className="joy-detail__kicker">A LITTLE THING, MADE FOR YOU</span>
                    <h1>{product.title}</h1>
                    {product.description && <p className="joy-detail__description">{product.description}</p>}
                    <div className="joy-detail__price-row"><Price pricing={pricing} /></div>

                    {purchaseOptions.length > 0 && <fieldset className="joy-detail__option-group">
                        <legend>Chọn phiên bản</legend>
                        <div className="joy-detail__options">
                            {purchaseOptions.map(option => (
                                <button
                                    type="button"
                                    key={option.id}
                                    aria-pressed={String(selectedOptionId) === String(option.id)}
                                    className={String(selectedOptionId) === String(option.id) ? 'is-active' : ''}
                                    onClick={() => setSelectedOptionId(option.id)}
                                >
                                    {option.color && <i style={{ backgroundColor: option.color }} aria-hidden="true" />}
                                    {option.label || option.name}
                                </button>
                            ))}
                        </div>
                    </fieldset>}

                    {materials.length > 0 && <label className="joy-detail__material">
                        <span>Chất liệu</span>
                        <select value={selectedMaterialId} onChange={event => setSelectedMaterialId(event.target.value)}>
                            {materials.length > 1 && <option value="">Chọn chất liệu</option>}
                            {materials.map(material => <option key={material.id} value={material.id}>{material.name}{material.premium ? ' (+' + Number(material.premium).toLocaleString('vi-VN') + ' ₫)' : ''}</option>)}
                        </select>
                    </label>}

                    {pricing.canPurchase ? <div className="joy-detail__purchase">
                        <div className="joy-detail__quantity" aria-label="Số lượng">
                            <button type="button" aria-label="Giảm số lượng" disabled={quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))}>−</button>
                            <output aria-live="polite">{quantity}</output>
                            <button type="button" aria-label="Tăng số lượng" onClick={() => setQuantity(value => value + 1)}>+</button>
                        </div>
                        <button type="button" className="joy-detail__button joy-detail__button--primary" onClick={addCurrentItem}>Thêm vào giỏ</button>
                    </div> : <p className="joy-detail__availability" role="status">
                        {pricing.status === 'not-ready-for-sale'
                            ? 'Sản phẩm hiện chưa mở bán.'
                            : pricing.status === 'option-required'
                                ? 'Vui lòng chọn phiên bản để xem giá và trạng thái mua.'
                                : pricing.status === 'material-required'
                                    ? 'Vui lòng chọn chất liệu để xem giá và trạng thái mua.'
                                    : pricing.status === 'invalid-option-price' || pricing.status === 'invalid-material-premium' || pricing.status === 'invalid-total'
                                        ? 'Giá của lựa chọn này chưa hợp lệ hoặc chưa được xác nhận.'
                                        : 'Thông tin giá và thời điểm mở bán sẽ được cập nhật khi được xác nhận.'}
                    </p>}

                    <div className="joy-detail__trust-note"><span aria-hidden="true">✳</span><p>Thông tin và lựa chọn chỉ xuất hiện khi đã được xác nhận.</p></div>
                </div>
            </section>

            <section className="joy-detail__information" aria-labelledby="product-information-title">
                <div className="joy-detail__section-heading">
                    <span className="joy-detail__kicker">THE LITTLE DETAILS</span>
                    <h2 id="product-information-title">Về món đồ này<span>.</span></h2>
                </div>
                <div className="joy-detail__information-grid">
                    <article className="joy-detail__description-card">
                        <h3>Thông tin sản phẩm</h3>
                        {product.description
                            ? <p>{product.description}</p>
                            : <p>Thông tin chi tiết sẽ được cập nhật khi sẵn sàng công bố.</p>}
                    </article>
                    {publicDetails.length > 0 && <article className="joy-detail__facts-card">
                        <h3>Chi tiết đã xác nhận</h3>
                        <dl>{publicDetails.filter(detail => detail?.label && detail?.value).map((detail, index) => (
                            <div key={detail.id || detail.label + index}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>
                        ))}</dl>
                    </article>}
                </div>
            </section>

            {reviews.length > 0 && <section className="joy-detail__reviews" aria-labelledby="reviews-title">
                <div className="joy-detail__section-heading">
                    <span className="joy-detail__kicker">REAL WORDS, REAL PEOPLE</span>
                    <h2 id="reviews-title">Đánh giá khách hàng<span>.</span></h2>
                </div>
                <div className="joy-detail__review-grid">
                    {reviews.map(review => <article key={review.id} className="joy-detail__review">
                        <div><strong>{review.author || review.name}</strong><span>{Number(review.rating)}/5</span></div>
                        <p>{review.text}</p>
                    </article>)}
                </div>
            </section>}

            {related.length > 0 && <section className="joy-detail__related" aria-labelledby="related-title">
                <div className="joy-detail__section-heading">
                    <span className="joy-detail__kicker">KEEP THE JOY CLOSE</span>
                    <h2 id="related-title">Cùng một vibe<span>.</span></h2>
                    <Link to="/marketplace">Xem toàn bộ cửa hàng →</Link>
                </div>
                <div className="joy-detail__related-grid">
                    {related.map(item => <ProductCard key={item.id} product={item} compact />)}
                </div>
            </section>}
        </div>
    );
}
