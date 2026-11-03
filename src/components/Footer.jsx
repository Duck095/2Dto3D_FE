import { Link } from 'react-router-dom';
import approvedLogo from '../assets/approved-3d-keychain-logo.webp';

const groups = [
  { title: 'Cửa hàng', links: [{ label: 'Tất cả sản phẩm', to: '/marketplace' }, { label: 'Clicky & Fidget', to: '/marketplace?collection=clicky-fidget' }, { label: 'Cute & Sweet', to: '/marketplace?collection=cute-sweet' }, { label: 'Quà tặng cá nhân hóa', to: '/marketplace?collection=personalized-gifts' }] },
  { title: 'Khám phá', links: [{ label: 'Sáng tạo AI', to: '/studio' }, { label: 'Kho mô hình 3D', to: '/products' }, { label: 'Hướng dẫn', to: '/workflow' }, { label: 'Về 2Dto3D', to: '/about' }, { label: 'Giỏ hàng', to: '/cart' }] },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Link to="/" className="site-brand"><img src={approvedLogo} alt="" aria-hidden="true" className="site-brand__logo" /><span>2Dto3D<span className="site-brand__tag">POCKET JOY</span></span></Link>
            <p>Tiny things, big feelings. Pocket Joy là dòng sản phẩm móc khóa vui mắt, vui tay và mang dấu ấn cá nhân.</p>
          </div>
          <div className="site-footer__links">{groups.map(group => <div className="site-footer__group" key={group.title}><h3>{group.title}</h3>{group.links.map(link => <Link to={link.to} key={link.label}>{link.label}</Link>)}</div>)}</div>
        </div>
        <div className="site-footer__bottom"><span>© {new Date().getFullYear()} 2Dto3D · Pocket Joy</span><span>Tiny things, big feelings ✳</span></div>
      </div>
    </footer>
  );
}
