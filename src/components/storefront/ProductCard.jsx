import { Link } from 'react-router-dom';
import { PRODUCT_COLLECTIONS } from '../../data/productModels';
import { getApprovedProductMedia, requiresProductDetailSelection, resolveStorefrontPricing } from '../../features/storefront/productPresentation';
import { useCart } from '../../context/CartContext';
import './product-card.css';

export default function ProductCard({ product, compact = false }) {
    const { addItem } = useCart();
    const media = getApprovedProductMedia(product);
    const pricing = resolveStorefrontPricing(product);
    const requiresSelection = requiresProductDetailSelection(product);
    const collection = PRODUCT_COLLECTIONS.find(item => product.collections?.includes(item.id));
    const detailPath = '/product/' + product.id;

    return (
        <article className={'joy-product-card' + (compact ? ' joy-product-card--compact' : '')}>
            <Link className="joy-product-card__media" to={detailPath} aria-label={'Xem ' + product.title}>
                {media.images[0]
                    ? <img src={media.images[0]} alt={product.title} loading="lazy" />
                    : <span className="joy-product-card__placeholder" aria-label="Chưa có ảnh sản phẩm được duyệt">
                        <span aria-hidden="true">✳</span>
                        <small>ẢNH SẢN PHẨM SẼ CẬP NHẬT</small>
                    </span>}
                {collection && <span className="joy-product-card__collection">{collection.title}</span>}
            </Link>
            <div className="joy-product-card__body">
                <div className="joy-product-card__heading">
                    <Link to={detailPath} className="joy-product-card__title">{product.title}</Link>
                    {pricing.priceLabel
                        ? <strong className="joy-product-card__price">{pricing.priceLabel}</strong>
                        : <span className="joy-product-card__price-note">{requiresSelection ? 'Chọn tuỳ chọn để xem giá' : 'Giá chưa công bố'}</span>}
                </div>
                {!compact && product.description && <p className="joy-product-card__description">{product.description}</p>}
                <div className="joy-product-card__actions">
                    <Link className="joy-shop-button joy-shop-button--secondary" to={detailPath}>{requiresSelection ? 'Chọn tuỳ chọn' : 'Xem chi tiết'}</Link>
                    {pricing.canPurchase && !requiresSelection && <button
                        type="button"
                        className="joy-shop-button joy-shop-button--primary"
                        onClick={() => addItem(product, { option: pricing.option, material: pricing.material, quantity: 1 })}
                    >Thêm vào giỏ</button>}
                </div>
            </div>
        </article>
    );
}
