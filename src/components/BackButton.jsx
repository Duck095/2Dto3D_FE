import { Link } from 'react-router-dom';

/**
 * BackButton – dùng chung ở đầu các trang con để quay lại Home.
 * Props:
 *   to       – đường dẫn muốn quay về (mặc định "/")
 *   label    – nhãn hiển thị (mặc định "Trang chủ")
 *   className – class tùy chỉnh thêm
 */
export default function BackButton({ to = '/', label = 'Trang chủ', className = '' }) {
    return (
        <Link
            to={to}
            className={`inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-primary transition-colors duration-200 group ${className}`}
        >
            <span className="w-8 h-8 rounded-full border border-slate-200 group-hover:border-brand-primary group-hover:bg-brand-light/10 flex items-center justify-center transition-all duration-200 text-slate-600 group-hover:text-brand-primary">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="group-hover:-translate-x-0.5 transition-transform duration-200"
                >
                    <path d="M15 18l-6-6 6-6" />
                </svg>
            </span>
            {label}
        </Link>
    );
}
