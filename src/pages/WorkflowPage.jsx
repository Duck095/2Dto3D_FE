import { Link } from 'react-router-dom';

const steps = [
    {
        number: '01',
        title: 'Chọn cách bắt đầu',
        description: 'Mở AI Studio để bắt đầu từ hình ảnh hoặc mô tả bằng văn bản.',
        links: [
            { label: 'Dùng hình ảnh', to: '/studio?mode=image' },
            { label: 'Dùng mô tả', to: '/studio?mode=text' },
        ],
    },
    {
        number: '02',
        title: 'Xem và tinh chỉnh mô hình',
        description: 'Tiếp tục trong AI Studio để xem mô hình 3D và sử dụng những công cụ đang có trong giao diện.',
        links: [{ label: 'Mở AI Studio', to: '/studio' }],
    },
    {
        number: '03',
        title: 'Chuẩn bị cho bước in',
        description: 'Nếu Studio tạo bản nháp in, bạn có thể mở phần ước tính từ bản nháp đó. Con số trên trang ước tính chưa phải báo giá chính thức và không gửi yêu cầu đặt in.',
        links: [],
    },
];

export default function WorkflowPage() {
    return (
        <div className="joy-guide">
            <div className="joy-guide__inner">
                <header className="joy-guide__header">
                    <p className="joy-guide__eyebrow">Hướng dẫn · 2Dto3D</p>
                    <h1>Từ ý tưởng đến mô hình 3D</h1>
                    <p>Trang này giới thiệu các bước có trong nền tảng hiện tại. Việc chuẩn bị mô hình chưa đồng nghĩa với việc gửi hoặc xác nhận đơn in.</p>
                </header>

                <section className="joy-guide__steps" id="quy-trinh-in" aria-label="Các bước sử dụng 2Dto3D">
                    {steps.map(step => (
                        <article className="joy-guide__step" key={step.number}>
                            <span className="joy-guide__number">{step.number}</span>
                            <div>
                                <h2>{step.title}</h2>
                                <p>{step.description}</p>
                                {step.links.length > 0 && <div className="joy-guide__links">
                                    {step.links.map(link => <Link to={link.to} key={link.to}>{link.label}<span aria-hidden="true">→</span></Link>)}
                                </div>}
                            </div>
                        </article>
                    ))}
                </section>

                <p className="joy-guide__note">Thông tin thanh toán, vận chuyển và báo giá chính thức sẽ được công bố khi các quy trình đó sẵn sàng.</p>
            </div>
        </div>
    );
}
