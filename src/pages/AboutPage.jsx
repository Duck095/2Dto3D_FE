import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="joy-about">
      <div className="joy-about__inner">
        <header className="joy-about__hero">
          <p className="joy-about__eyebrow">Về chúng tôi · 2Dto3D</p>
          <h1>Ý tưởng của bạn, gần hơn với thế giới 3D.</h1>
          <p>2Dto3D kết hợp công cụ sáng tạo AI với quy trình làm việc cùng mô hình 3D.</p>
        </header>

        <section className="joy-about__card" id="nen-tang">
          <span aria-hidden="true">◇</span>
          <div><p className="joy-about__eyebrow">Nền tảng</p><h2>Từ ý tưởng đến mô hình</h2>
            <p>AI Studio hiện hỗ trợ bắt đầu từ hình ảnh hoặc mô tả văn bản. Các bước tiếp theo phụ thuộc vào công cụ và trạng thái bản nháp đang có.</p>
            <Link to="/studio?mode=image">Khám phá AI Studio <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="joy-about__card joy-about__card--pink" id="pocket-joy">
          <span aria-hidden="true">✳</span>
          <div><p className="joy-about__eyebrow">Dòng sản phẩm</p><h2>Pocket Joy — Tiny Things, Big Feelings</h2>
            <p>Pocket Joy là hướng cửa hàng tập trung vào Clicky/Fidget Keychains, cùng các nhóm móc khóa dễ thương, đồ sưu tầm và quà tặng cá nhân hóa.</p>
            <Link to="/marketplace">Xem cửa hàng <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="joy-about__process" id="quy-trinh">
          <p className="joy-about__eyebrow">Quy trình hiện tại</p><h2>Khám phá từng bước</h2>
          <p>Bạn có thể bắt đầu tạo mô hình, xem hướng dẫn sử dụng và chuẩn bị bản nháp. Trang ước tính không gửi yêu cầu đặt in; đặt hàng trực tuyến chưa được hỗ trợ.</p>
          <div><Link to="/workflow">Đọc hướng dẫn <span aria-hidden="true">→</span></Link><Link to="/products">Xem kho mô hình 3D <span aria-hidden="true">→</span></Link></div>
        </section>
      </div>
    </div>
  );
}
