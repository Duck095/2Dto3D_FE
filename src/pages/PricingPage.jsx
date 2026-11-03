import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getMembershipPlanId, getPricingMembershipState } from '../features/membership/membershipPresentation';
import { MEMBERSHIP_API_SUPPORTED } from '../services/membershipService';
import approvedLogo from '../assets/approved-3d-keychain-logo.webp';
import './pricing.css';

export default function PricingPage() {
    const { membership, membershipStatus, isAuthenticated, isLoading, refreshMembership } = useAuth();
    const membershipState = getPricingMembershipState({ isLoading, isAuthenticated, membership, membershipStatus });
    const accountPlan = membershipState === 'current' ? getMembershipPlanId(membership) : null;

    return (
        <div className="pricing-page">
            <div className="pricing-page__container">
                <header className="pricing-page__hero">
                    <img src={approvedLogo} alt="" aria-hidden="true" className="pricing-page__brand-logo" />
                    <p className="pricing-page__eyebrow">2Dto3D · Pocket Joy</p>
                    <h1>Gói thành viên</h1>
                    <p className="pricing-page__intro">Thông tin giá và quyền lợi sẽ hiển thị khi có dữ liệu chính thức được xác nhận.</p>
                </header>

                <section className="pricing-page__content" aria-label="Thông tin gói thành viên">
                    <article className="pricing-page__notice" role="status">
                        <span className="pricing-page__notice-icon material-symbols-outlined" aria-hidden="true">auto_awesome</span>
                        <div>
                            <h2>Thông tin gói đang được cập nhật</h2>
                            <p>Hiện chưa có danh sách gói, giá hoặc quyền lợi được xác nhận để công bố.</p>
                        </div>
                    </article>

                    {membershipState === 'loading' && (
                        <article className="pricing-page__account-card" aria-live="polite">
                            <span className="pricing-page__spinner" aria-hidden="true" />
                            <p>Đang kiểm tra thông tin tài khoản…</p>
                        </article>
                    )}

                    {membershipState === 'current' && (
                        <article className="pricing-page__account-card" aria-label="Membership hiện có trên tài khoản">
                            <span className="material-symbols-outlined" aria-hidden="true">account_circle</span>
                            <div>
                                <p className="pricing-page__account-label">Gói trên tài khoản</p>
                                <h2>{accountPlan}</h2>
                                <p>Hiển thị theo membership được AuthContext cung cấp. Chi tiết quyền lợi đang được cập nhật.</p>
                            </div>
                        </article>
                    )}

                    {membershipState === 'unauthenticated' && (
                        <article className="pricing-page__account-card">
                            <span className="material-symbols-outlined" aria-hidden="true">person</span>
                            <div>
                                <p className="pricing-page__account-label">Tài khoản</p>
                                <h2>Đăng nhập để xem membership</h2>
                                <Link to="/login" className="pricing-page__login-link">Đăng nhập</Link>
                            </div>
                        </article>
                    )}

                    {membershipState === 'unavailable' && (
                        <article className="pricing-page__account-card" role="status">
                            <span className="material-symbols-outlined" aria-hidden="true">info</span>
                            <div>
                                <p className="pricing-page__account-label">Tài khoản</p>
                                <h2>Chưa có thông tin membership hợp lệ</h2>
                                <p>Trang này không tự suy đoán gói mặc định.</p>
                            </div>
                        </article>
                    )}

                    {membershipState === 'refresh-failed' && MEMBERSHIP_API_SUPPORTED && (
                        <article className="pricing-page__account-card" role="alert">
                            <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
                            <div>
                                <p className="pricing-page__account-label">Tài khoản</p>
                                <h2>Chưa thể kiểm tra membership</h2>
                                <p>Kết nối tới máy chủ không thành công. Thông tin đã lưu không được xem là membership hiện tại.</p>
                                <button type="button" className="pricing-page__login-link" onClick={refreshMembership}>Thử lại</button>
                            </div>
                        </article>
                    )}

                    {membershipState === 'unavailable' && isAuthenticated && !MEMBERSHIP_API_SUPPORTED && (
                        <p className="pricing-page__account-unavailable" role="status">
                            Backend hiện chưa hỗ trợ membership; chưa thể xác nhận gói hoặc quyền lợi của tài khoản.
                        </p>
                    )}
                </section>
            </div>
        </div>
    );
}
