import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
                    <span className="material-symbols-outlined mb-4 text-[72px] text-rose-400">error</span>
                    <h1 className="mb-2 text-2xl font-extrabold text-slate-900">Đã xảy ra lỗi</h1>
                    <p className="mb-6 max-w-md text-sm text-slate-500">
                        Ứng dụng gặp sự cố không mong muốn. Vui lòng thử tải lại trang.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-primary flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold"
                    >
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                        Tải lại trang
                    </button>
                    {this.state.error && (
                        <details className="mt-6 max-w-lg text-left">
                            <summary className="cursor-pointer text-xs font-semibold text-slate-400">Chi tiết lỗi</summary>
                            <pre className="mt-2 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
                                {this.state.error.toString()}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
