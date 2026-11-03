import { Link } from 'react-router-dom';

export default function ProductsPage() {
    return (
        <div className="joy-library">
            <div className="joy-library__inner">
                <header className="joy-library__header">
                    <p className="joy-library__eyebrow">Thư viện 3D · 2Dto3D</p>
                    <h1>Kho mô hình 3D</h1>
                    <p>Kho mẫu dành cho các mô hình 3D công khai đã được duyệt. Thư viện này tách biệt với cửa hàng sản phẩm vật lý Pocket Joy.</p>
                </header>

                <section className="joy-library__empty" role="status" aria-labelledby="joy-library-empty-title">
                    <div className="joy-library__icon" aria-hidden="true">◇</div>
                    <h2 id="joy-library-empty-title">Chưa có mô hình công khai được duyệt</h2>
                    <p>Khi có mô hình được xác nhận để chia sẻ công khai, chúng sẽ xuất hiện tại đây.</p>
                    <div className="joy-library__actions">
                        <Link className="joy-library__button joy-library__button--primary" to="/studio?mode=image">Tạo mô hình từ ảnh</Link>
                        <Link className="joy-library__button joy-library__button--secondary" to="/marketplace">Đến cửa hàng</Link>
                    </div>
                </section>
            </div>
        </div>
    );
}
