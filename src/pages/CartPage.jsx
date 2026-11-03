import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useCart } from '../context/CartContext';

function formatVND(value) {
    return `${value.toLocaleString('vi-VN')} ₫`;
}

function ProductImage({ item }) {
    const [failed, setFailed] = useState(false);
    if (!item.img || failed) return <div className="cart-item__placeholder" aria-label="Chưa có hình ảnh sản phẩm được duyệt"><span aria-hidden="true">✿</span></div>;
    return <img src={item.img} alt={item.title} className="cart-item__image" onError={() => setFailed(true)} />;
}

function RestoreNotice({ notice, onDismiss, migrationBlocked, onReplace }) {
    if (!notice) return null;
    return (
        <div className="cart-notice" role="status">
            <p>{notice}</p>
            {migrationBlocked ? (
                <button type="button" className="cart-notice__replace" onClick={onReplace}>Xóa dữ liệu giỏ cũ và lưu giỏ đã xác thực</button>
            ) : (
                <button type="button" onClick={onDismiss} aria-label="Đóng thông báo">×</button>
            )}
        </div>
    );
}

export default function CartPage() {
    const { items, updateQuantity, removeItem, cartNotice, dismissCartNotice, migrationBlocked, replaceUnmigratedCart } = useCart();
    const subtotal = items.reduce((total, item) => total + (item.priceNum + item.materialPremium) * item.quantity, 0);

    return (
        <div className="cart-page">
            <div className="cart-page__inner">
                <RestoreNotice
                    notice={cartNotice}
                    onDismiss={dismissCartNotice}
                    migrationBlocked={migrationBlocked}
                    onReplace={replaceUnmigratedCart}
                />
                <header className="cart-page__header">
                    <div>
                        <p className="cart-eyebrow">Pocket Joy · Giỏ hàng</p>
                        <h1>Những món bạn đã chọn</h1>
                    </div>
                    <Link to="/marketplace" className="cart-text-link">← Tiếp tục khám phá</Link>
                </header>

                {items.length === 0 ? (
                    <section className="cart-empty" aria-labelledby="cart-empty-title">
                        <div className="cart-empty__art" aria-hidden="true"><span>♡</span><i>✦</i></div>
                        <p className="cart-eyebrow">Một chiếc giỏ đang chờ niềm vui</p>
                        <h2 id="cart-empty-title">Giỏ hàng đang trống</h2>
                        <p>Các sản phẩm bạn chọn sẽ xuất hiện ở đây. Hiện chưa có sản phẩm nào được duyệt để bán.</p>
                        <Link to="/marketplace" className="cart-button cart-button--secondary">Khám phá cửa hàng</Link>
                    </section>
                ) : (
                    <div className="cart-layout">
                        <section className="cart-items" aria-label="Sản phẩm trong giỏ">
                            <div className="cart-items__heading"><strong>{items.length} sản phẩm</strong><span>Giá được xác nhận theo catalog hiện tại</span></div>
                            {items.map(item => (
                                <article className="cart-item" key={item.key}>
                                    <ProductImage item={item} />
                                    <div className="cart-item__details">
                                        <h2>{item.title}</h2>
                                        <p className="cart-item__options">{[item.variantLabel, item.materialName].filter(Boolean).join(' · ') || 'Tuỳ chọn mặc định'}</p>
                                        <p className="cart-item__price">{formatVND(item.priceNum + item.materialPremium)} <span>/ sản phẩm</span></p>
                                    </div>
                                    <div className="cart-item__controls">
                                        <button type="button" className="cart-remove" onClick={() => removeItem(item.key)} aria-label={`Xóa ${item.title} khỏi giỏ`}>Xóa</button>
                                        <div className="cart-quantity" aria-label={`Số lượng ${item.title}`}>
                                            <button type="button" onClick={() => updateQuantity(item.key, item.quantity - 1)} aria-label="Giảm số lượng">−</button>
                                            <span>{item.quantity}</span>
                                            <button type="button" onClick={() => updateQuantity(item.key, item.quantity + 1)} aria-label="Tăng số lượng">+</button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </section>

                        <aside className="cart-summary" aria-label="Tóm tắt giỏ hàng">
                            <p className="cart-eyebrow">Tóm tắt</p>
                            <h2>Đơn hàng của bạn</h2>
                            <div className="cart-summary__row"><span>Tạm tính sản phẩm</span><strong>{formatVND(subtotal)}</strong></div>
                            <div className="cart-summary__shipping">Phí vận chuyển sẽ được xác nhận khi đặt hàng.</div>
                            <div className="cart-summary__total"><span>Tạm tính</span><strong>{formatVND(subtotal)}</strong></div>
                            <Link to="/checkout" className="cart-button cart-button--primary">Xem thông tin đặt hàng <span aria-hidden="true">→</span></Link>
                            <p className="cart-summary__note">Đặt hàng trực tuyến hiện chưa được hỗ trợ. Chưa có khoản thanh toán nào được tạo.</p>
                        </aside>
                    </div>
                )}
            </div>
        </div>
    );
}
