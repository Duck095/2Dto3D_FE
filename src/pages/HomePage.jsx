import { Link } from 'react-router-dom';
import { HiArrowRight, HiOutlineBolt, HiOutlineGift, HiOutlineSparkles, HiOutlineHeart, HiOutlinePlay } from 'react-icons/hi2';
import './homepage.css';

const vibes = [
  { title: 'Clicky & Fidget', note: 'Bấm một cái, vui một chút.', icon: HiOutlineBolt, tone: 'pink', collection: 'clicky-fidget' },
  { title: 'Cute & Sweet', note: 'Nhỏ xinh mang theo mỗi ngày.', icon: HiOutlineHeart, tone: 'lavender', collection: 'cute-sweet' },
  { title: 'Characters & Collectibles', note: 'Sưu tầm điều làm bạn vui.', icon: HiOutlineSparkles, tone: 'mint', collection: 'characters-collectibles' },
  { title: 'Personalized Gifts', note: 'Thêm dấu ấn của riêng bạn.', icon: HiOutlineGift, tone: 'butter', collection: 'personalized-gifts' },
];

function PocketJoyIllustration() {
  return (
    <div className="pocket-illustration" role="img" aria-label="Minh họa concept nguyên bản cho Pocket Joy, không phải ảnh sản phẩm">
      <span className="pocket-illustration__orbit pocket-illustration__orbit--one" />
      <span className="pocket-illustration__orbit pocket-illustration__orbit--two" />
      <span className="pocket-illustration__spark pocket-illustration__spark--one">✳</span>
      <span className="pocket-illustration__spark pocket-illustration__spark--two">✦</span>
      <div className="pocket-illustration__tag"><span className="pocket-illustration__hole" /><span>tiny<br />joy</span><span className="pocket-illustration__smile">⌣</span></div>
      <span className="pocket-illustration__caption">MINH HỌA CONCEPT · KHÔNG PHẢI ẢNH SẢN PHẨM</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="pocket-home">
      <section className="pocket-hero" aria-labelledby="hero-title">
        <div className="pocket-wrap pocket-hero__grid">
          <div className="pocket-hero__copy">
            <span className="pocket-eyebrow"><span /> POCKET JOY — TINY THINGS, BIG FEELINGS</span>
            <h1 id="hero-title">Small keychain.<br /><span>Big happiness.</span></h1>
            <p>Móc khóa xinh xắn, bấm vui tay và mang chút cá tính của bạn đi khắp nơi. Tìm niềm vui nhỏ hợp với mình nhé.</p>
            <Link to="/marketplace" className="pocket-button pocket-button--plum">Khám phá bộ sưu tập <HiArrowRight aria-hidden="true" /></Link>
            <span className="pocket-hero__footnote">Một chiếc nhỏ xíu, một niềm vui vừa đủ ✳</span>
          </div>
          <PocketJoyIllustration />
        </div>
        <div className="pocket-marquee" aria-hidden="true"><span>click · collect · carry a little joy</span><i>✳</i><span>click · collect · carry a little joy</span><i>✳</i></div>
      </section>

      <section className="pocket-section pocket-vibes" aria-labelledby="vibes-title">
        <div className="pocket-wrap">
          <div className="pocket-section__heading"><div><span className="pocket-kicker">FIND YOUR LITTLE THING</span><h2 id="vibes-title">Shop by vibe<span>.</span></h2><p>Hôm nay bạn muốn mang theo cảm giác nào?</p></div><Link to="/marketplace" className="pocket-text-link">Xem tất cả <HiArrowRight aria-hidden="true" /></Link></div>
          <div className="pocket-vibe-grid">
            {vibes.map(({ title, note, icon: Icon, tone, collection }, index) => (
              <Link to={`/marketplace?collection=${collection}`} className={`pocket-vibe pocket-vibe--${tone}`} key={title}>
                <span className="pocket-vibe__index">0{index + 1}</span><span className="pocket-vibe__icon"><Icon aria-hidden="true" /></span>
                <span className="pocket-vibe__copy"><strong>{title}</strong><small>{note}</small></span><span className="pocket-vibe__arrow"><HiArrowRight aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="pocket-section pocket-featured" aria-labelledby="featured-title">
        <div className="pocket-wrap">
          <div className="pocket-section__heading"><div><span className="pocket-kicker">THE LITTLE THINGS SHOP</span><h2 id="featured-title">Made for your pocket<span>.</span></h2><p>Những món đồ vui sẽ xuất hiện tại đây khi sẵn sàng ra mắt.</p></div><Link to="/marketplace" className="pocket-text-link">Đến cửa hàng <HiArrowRight aria-hidden="true" /></Link></div>
          <div className="pocket-empty" role="status"><span className="pocket-empty__doodle" aria-hidden="true">✳</span><div><strong>Đang chuẩn bị những niềm vui đầu tiên</strong><p>Hiện chưa có sản phẩm nào được xác nhận sẵn sàng trưng bày. Ghé lại sau nhé!</p><Link to="/marketplace">Khám phá cửa hàng <HiArrowRight aria-hidden="true" /></Link></div><span className="pocket-empty__stamp" aria-hidden="true">COMING<br />WITH JOY</span></div>
        </div>
      </section>

      <section className="pocket-click" aria-labelledby="click-title">
        <div className="pocket-wrap pocket-click__inner">
          <div className="pocket-click__copy"><span className="pocket-kicker">SOUND ON, STRESS OFF</span><h2 id="click-title">See the click<span>.</span><br />Feel the happy.</h2><p>Tiếng “tách” nhỏ, cảm giác vui tay. Video sản phẩm thật sẽ được giới thiệu khi có tư liệu được cấp quyền.</p></div>
          <div className="pocket-click__media" role="status"><span className="pocket-click__play"><HiOutlinePlay aria-hidden="true" /></span><span>Chưa có video sản phẩm được cấp quyền</span><small>KHU VỰC VIDEO · SẴN SÀNG TÍCH HỢP</small></div>
        </div>
      </section>

      <section className="pocket-gift" aria-labelledby="gift-title"><div className="pocket-wrap pocket-gift__inner"><div><span className="pocket-kicker">A LITTLE JOY GOES A LONG WAY</span><h2 id="gift-title">A tiny gift.<br /><span>A big “you get me”.</span></h2><p>Món quà nhỏ dành cho người bạn hiểu rõ — hoặc cho chính bạn, vì bạn xứng đáng.</p><Link to="/marketplace" className="pocket-button pocket-button--cream">Khám phá cửa hàng <HiArrowRight aria-hidden="true" /></Link></div><div className="pocket-gift__art" aria-hidden="true"><span>for<br /><b>you</b></span><i>♥</i><small>just because</small></div></div></section>
    </div>
  );
}
