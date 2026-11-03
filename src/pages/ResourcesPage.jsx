import { Link } from 'react-router-dom';

export default function ResourcesPage() {
    return (
        <div className="joy-guide">
            <div className="joy-guide__inner">
                <header className="joy-guide__header">
                    <p className="joy-guide__eyebrow">Tài liệu · 2Dto3D</p>
                    <h1>Tài nguyên hướng dẫn</h1>
                    <p>Nội dung hướng dẫn đang được rà soát trước khi công khai.</p>
                </header>
                <section className="joy-resources__empty" role="status">
                    <span aria-hidden="true">✦</span>
                    <h2>Chưa có tài liệu đã xác minh để hiển thị</h2>
                    <p>Chúng tôi sẽ bổ sung hướng dẫn khi nội dung và thông tin liên quan đã sẵn sàng.</p>
                    <Link to="/workflow">Xem quy trình sử dụng hiện tại <span aria-hidden="true">→</span></Link>
                </section>
            </div>
        </div>
    );
}
