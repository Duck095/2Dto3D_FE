import { Link } from 'react-router-dom';
import './not-found.css';

export default function NotFoundPage() {
    return (
        <section className="not-found-page" aria-labelledby="not-found-title">
            <div className="not-found-page__card">
                <div className="not-found-page__illustration" aria-hidden="true">
                    <span className="not-found-page__sparkle not-found-page__sparkle--one">✦</span>
                    <span className="not-found-page__shape">?</span>
                    <span className="not-found-page__sparkle not-found-page__sparkle--two">✧</span>
                </div>
                <p className="not-found-page__eyebrow">2Dto3D · Pocket Joy</p>
                <h1 id="not-found-title">404</h1>
                <h2>Trang không tồn tại</h2>
                <p className="not-found-page__message">
                    Đường dẫn này không tồn tại hoặc đã được di chuyển. Bạn có thể quay về trang chủ hoặc tiếp tục khám phá cửa hàng.
                </p>
                <div className="not-found-page__actions">
                    <Link to="/" className="not-found-page__button not-found-page__button--primary">
                        <span className="material-symbols-outlined" aria-hidden="true">home</span>
                        Quay về trang chủ
                    </Link>
                    <Link to="/marketplace" className="not-found-page__button not-found-page__button--secondary">
                        <span className="material-symbols-outlined" aria-hidden="true">storefront</span>
                        Khám phá cửa hàng
                    </Link>
                </div>
            </div>
        </section>
    );
}
