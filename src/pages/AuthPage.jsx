import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { getPostLoginPath } from '../features/auth/currentUserAccess';
import approvedLogo from '../assets/approved-3d-keychain-logo.webp';
import './auth-page.css';

const AUTH_CONTENT = {
    login: {
        eyebrow: 'Chào mừng trở lại',
        title: 'Tiếp tục hành trình sáng tạo',
        description: 'Đăng nhập để truy cập mô hình đã tạo, tùy chỉnh đã lưu và lịch sử xuất file.',
        submit: 'Đăng nhập',
        alternateText: 'Chưa có tài khoản?',
        alternateLabel: 'Tạo tài khoản',
        alternatePath: '/register',
    },
    register: {
        eyebrow: 'Bắt đầu từ hôm nay',
        title: 'Tạo không gian sáng tạo của bạn',
        description: 'Tạo tài khoản để quản lý mô hình, tùy chỉnh và lịch sử xuất file.',
        submit: 'Tạo tài khoản',
        alternateText: 'Đã có tài khoản?',
        alternateLabel: 'Đăng nhập',
        alternatePath: '/login',
    },
};

function PasswordInput({ id, label, value, onChange, error, autoComplete }) {
    const [visible, setVisible] = useState(false);
    const errorId = `${id}-error`;

    return (
        <div className="joy-auth__field">
            <label htmlFor={id} className="joy-auth__label">{label}</label>
            <span className={`joy-auth__input-wrap${error ? ' is-invalid' : ''}`}>
                <span className="material-symbols-outlined joy-auth__field-icon" aria-hidden="true">lock</span>
                <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    value={value}
                    onChange={onChange}
                    autoComplete={autoComplete}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? errorId : undefined}
                    placeholder="Tối thiểu 8 ký tự"
                    className="joy-auth__input"
                />
                <button
                    type="button"
                    onClick={() => setVisible(current => !current)}
                    className="joy-auth__password-toggle"
                    aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                    <span className="material-symbols-outlined" aria-hidden="true">{visible ? 'visibility_off' : 'visibility'}</span>
                </button>
            </span>
            {error && <span id={errorId} className="joy-auth__field-error" role="alert">{error}</span>}
        </div>
    );
}

function PocketJoyIllustration() {
    return (
        <div className="joy-auth__illustration" role="img" aria-label="Minh họa concept Pocket Joy, không phải ảnh sản phẩm">
            <span className="joy-auth__orbit joy-auth__orbit--one" />
            <span className="joy-auth__orbit joy-auth__orbit--two" />
            <span className="joy-auth__spark joy-auth__spark--one" aria-hidden="true">✳</span>
            <span className="joy-auth__spark joy-auth__spark--two" aria-hidden="true">✦</span>
            <div className="joy-auth__keyring" aria-hidden="true"><span /></div>
            <div className="joy-auth__tag" aria-hidden="true">
                <span className="joy-auth__tag-hole" />
                <span className="joy-auth__tag-word">tiny<br />joy</span>
                <span className="joy-auth__tag-smile">⌣</span>
            </div>
            <span className="joy-auth__concept-label">MINH HỌA CONCEPT · KHÔNG PHẢI ẢNH SẢN PHẨM</span>
        </div>
    );
}

export default function AuthPage({ mode = 'login' }) {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const isRegister = mode === 'register';
    const content = AUTH_CONTENT[mode];
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', registrationConfirmed: false });
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState('');
    const [registrationComplete, setRegistrationComplete] = useState(false);
    const submitLockRef = useRef(false);
    const redirectTimerRef = useRef(null);

    useEffect(() => () => {
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    }, []);

    function updateField(field, value) {
        setForm(current => ({ ...current, [field]: value }));
        setErrors(current => ({ ...current, [field]: '' }));
        setStatus('');
    }

    function validate() {
        const nextErrors = {};
        if (isRegister && form.name.trim().length < 2) nextErrors.name = 'Vui lòng nhập họ tên đầy đủ.';
        if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Vui lòng nhập địa chỉ email hợp lệ.';
        if (form.password.length < 8) nextErrors.password = 'Mật khẩu phải có tối thiểu 8 ký tự.';
        if (isRegister && form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Mật khẩu xác nhận không khớp.';
        if (isRegister && !form.registrationConfirmed) nextErrors.registrationConfirmed = 'Vui lòng xác nhận thông tin đăng ký.';
        return nextErrors;
    }

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (submitLockRef.current) return;

        const nextErrors = validate();
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length) return;

        submitLockRef.current = true;
        try {
            setLoading(true);

            if (isRegister) {
                await authApi.register({
                    name: form.name,
                    email: form.email,
                    phone: "",
                    password: form.password,
                });

                setStatus("Đăng ký thành công! Đang chuyển hướng...");
                setRegistrationComplete(true);
                redirectTimerRef.current = setTimeout(() => {
                    redirectTimerRef.current = null;
                    navigate("/login");
                }, 1000);
            } else {
                const res = await authApi.login({
                    email: form.email,
                    password: form.password,
                });

                const currentUser = await login(res);
                if (!currentUser) {
                    setErrors({ submit: 'Chưa thể xác minh danh tính với máy chủ. Phiên đăng nhập chưa được sử dụng để chuyển hướng.' });
                    return;
                }

                const destination = getPostLoginPath(currentUser);
                if (!destination) throw new Error('Phản hồi danh tính từ máy chủ không hợp lệ.');
                navigate(destination);
            }
        } catch (err) {
            submitLockRef.current = false;
            setStatus("");

            setErrors({ submit: err.response?.data?.message || err.message || 'Xác thực thất bại. Vui lòng thử lại.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="joy-auth">
            <div className="joy-auth__shell">
                <section className="joy-auth__intro" aria-labelledby="auth-intro-title">
                    <div className="joy-auth__brand">
                        <img src={approvedLogo} alt="" aria-hidden="true" className="joy-auth__brand-logo" />
                        <span><strong>2Dto3D</strong><small>Pocket Joy · Tiny things, big feelings</small></span>
                    </div>
                    <div className="joy-auth__intro-copy">
                        <span className="joy-auth__eyebrow">{isRegister ? 'CHÀO MỪNG ĐẾN VỚI POCKET JOY' : 'POCKET JOY · TINY THINGS, BIG FEELINGS'}</span>
                        <h2 id="auth-intro-title">Một chút sáng tạo,<br /><span>một niềm vui thật riêng.</span></h2>
                        <p>Đăng nhập để tiếp tục làm việc với những mô hình và ý tưởng của bạn.</p>
                    </div>
                    <PocketJoyIllustration />
                </section>

                <section className="joy-auth__form-panel" aria-labelledby="auth-title">
                    <header className="joy-auth__form-header">
                        <span className="joy-auth__form-icon material-symbols-outlined" aria-hidden="true">{isRegister ? 'person_add' : 'waving_hand'}</span>
                        <p className="joy-auth__eyebrow">{content.eyebrow}</p>
                        <h1 id="auth-title">{content.title}</h1>
                        <p className="joy-auth__description">{content.description}</p>
                    </header>

                    <form onSubmit={handleSubmit} noValidate className="joy-auth__form">
                        {isRegister && (
                            <label htmlFor="auth-name" className="joy-auth__field">
                                <span className="joy-auth__label">Họ và tên</span>
                                <span className={`joy-auth__input-wrap${errors.name ? ' is-invalid' : ''}`}>
                                    <span className="material-symbols-outlined joy-auth__field-icon" aria-hidden="true">person</span>
                                    <input id="auth-name" value={form.name} onChange={event => updateField('name', event.target.value)} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'auth-name-error' : undefined} className="joy-auth__input" placeholder="Tên của bạn" />
                                </span>
                                {errors.name && <span id="auth-name-error" className="joy-auth__field-error" role="alert">{errors.name}</span>}
                            </label>
                        )}

                        <label htmlFor="auth-email" className="joy-auth__field">
                            <span className="joy-auth__label">Địa chỉ email</span>
                            <span className={`joy-auth__input-wrap${errors.email ? ' is-invalid' : ''}`}>
                                <span className="material-symbols-outlined joy-auth__field-icon" aria-hidden="true">mail</span>
                                <input id="auth-email" type="email" value={form.email} onChange={event => updateField('email', event.target.value)} autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'auth-email-error' : undefined} className="joy-auth__input" placeholder="ban@example.com" />
                            </span>
                            {errors.email && <span id="auth-email-error" className="joy-auth__field-error" role="alert">{errors.email}</span>}
                        </label>

                        <PasswordInput id="auth-password" label="Mật khẩu" value={form.password} onChange={event => updateField('password', event.target.value)} error={errors.password} autoComplete={isRegister ? 'new-password' : 'current-password'} />
                        {isRegister && <PasswordInput id="auth-confirm-password" label="Xác nhận mật khẩu" value={form.confirmPassword} onChange={event => updateField('confirmPassword', event.target.value)} error={errors.confirmPassword} autoComplete="new-password" />}

                        {isRegister && (
                            <div className="joy-auth__registration-confirmation">
                                <label className="joy-auth__check joy-auth__check--top">
                                    <input type="checkbox" checked={form.registrationConfirmed} onChange={event => updateField('registrationConfirmed', event.target.checked)} aria-invalid={Boolean(errors.registrationConfirmed)} aria-describedby={errors.registrationConfirmed ? 'auth-registration-confirmation-error' : undefined} />
                                    <span>Tôi xác nhận thông tin đăng ký là chính xác.</span>
                                </label>
                                {errors.registrationConfirmed && <span id="auth-registration-confirmation-error" className="joy-auth__field-error" role="alert">{errors.registrationConfirmed}</span>}
                            </div>
                        )}

                        {errors.submit && <div className="joy-auth__message joy-auth__message--error" role="alert"><span className="material-symbols-outlined" aria-hidden="true">error</span>{errors.submit}</div>}
                        {status && <div className="joy-auth__message joy-auth__message--success" role="status" aria-live="polite"><span className="material-symbols-outlined" aria-hidden="true">check_circle</span>{status}</div>}

                        <button type="submit" disabled={loading || registrationComplete} aria-busy={loading} className="joy-auth__submit">
                            {loading && <span className="joy-auth__submit-spinner" aria-hidden="true" />}
                            <span>{loading ? 'Đang xử lý…' : content.submit}</span>
                            {!loading && <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>}
                        </button>
                    </form>

                    <p className="joy-auth__alternate">{content.alternateText}{' '}<Link to={content.alternatePath}>{content.alternateLabel}</Link></p>
                    <p className="joy-auth__footnote">2Dto3D · Pocket Joy</p>
                </section>
            </div>
        </div>
    );
}
