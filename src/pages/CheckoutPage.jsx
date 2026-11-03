import { Link } from 'react-router-dom';

export default function CheckoutPage() {
    return (
        <div className="checkout-status-page">
            <section className="checkout-status" aria-labelledby="checkout-status-title">
                <div className="checkout-status__icon" aria-hidden="true">♡</div>
                <p className="cart-eyebrow">Pocket Joy · Đặt hàng</p>
                <h1 id="checkout-status-title">Chưa hỗ trợ đặt hàng trực tuyến</h1>
                <p>Chúng tôi chưa thể tiếp nhận hoặc xử lý đơn hàng trên website. Chưa có thông tin liên hệ hay địa chỉ nào được gửi hoặc lưu, và giỏ hàng của bạn vẫn được giữ nguyên.</p>
                <p className="checkout-status__note">Phương thức thanh toán và phí vận chuyển sẽ được thông báo sau khi hệ thống đặt hàng chính thức sẵn sàng.</p>
                <div className="checkout-status__actions">
                    <Link to="/cart" className="cart-button cart-button--secondary">Quay lại giỏ hàng</Link>
                    <Link to="/marketplace" className="cart-text-link">Tiếp tục khám phá</Link>
                </div>
            </section>
        </div>
    );
}
