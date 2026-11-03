import { useEffect, useReducer, useRef, useState } from 'react';
import { HiOutlineShoppingBag, HiOutlineMagnifyingGlass, HiOutlineBars3, HiOutlineXMark, HiArrowRight, HiChevronDown } from 'react-icons/hi2';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { CUSTOMER_NAV_GROUPS, getNavigationPresentation, isNavigationGroupActive, transitionNavigationOverlay } from '../config/customerNavigation';
import approvedLogo from '../assets/approved-3d-keychain-logo.webp';
import RichMegaMenu, { MobileNavigationCards } from './RichMegaMenu';

const INITIAL_OVERLAYS = { mobileOpen: false, openGroup: null, searchOpen: false, accountOpen: false };

export default function Navbar() {
  const [overlays, dispatchOverlay] = useReducer(transitionNavigationOverlay, INITIAL_OVERLAYS);
  const { mobileOpen, openGroup, searchOpen, accountOpen } = overlays;
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1080px)').matches);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);
  const headerRef = useRef(null);
  const triggerRefs = useRef({});
  const { itemCount } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { showDesktopMegaMenu, showMobileMenu, visibleGroup } = getNavigationPresentation({ compact, mobileOpen, openGroup });

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    dispatchOverlay({ type: 'close-all' });
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1080px)');
    const onBreakpointChange = (event) => {
      setCompact(event.matches);
      dispatchOverlay({ type: 'close-all' });
    };
    setCompact(media.matches);
    media.addEventListener('change', onBreakpointChange);
    return () => media.removeEventListener('change', onBreakpointChange);
  }, []);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) {
        dispatchOverlay({ type: 'close-all' });
      }
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (mobileOpen && compact) {
        dispatchOverlay({ type: 'close-all' });
        triggerRefs.current.mobileMenu?.focus();
      } else if (openGroup && !compact) {
        const trigger = triggerRefs.current[openGroup];
        dispatchOverlay({ type: 'close-all' });
        trigger?.focus();
      } else if (accountOpen) {
        dispatchOverlay({ type: 'close-all' });
        triggerRefs.current.account?.focus();
      } else if (searchOpen) {
        dispatchOverlay({ type: 'close-all' });
        triggerRefs.current.search?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openGroup, mobileOpen, compact, accountOpen, searchOpen]);

  const submitSearch = (event) => {
    event.preventDefault();
    const search = query.trim();
    navigate(search ? `/marketplace?search=${encodeURIComponent(search)}` : '/marketplace');
    dispatchOverlay({ type: 'close-all' });
  };

  const handleLogout = () => {
    logout();
    dispatchOverlay({ type: 'close-all' });
    navigate('/');
  };

  const toggleGroup = (groupId, isCompact = compact) => dispatchOverlay({ type: 'open-group', groupId, compact: isCompact });

  return (
    <header className="site-header" ref={headerRef}>
      <div className="site-header__inner">
        <Link to="/" className="site-brand" aria-label="2Dto3D — Pocket Joy, về trang chủ">
          <img src={approvedLogo} alt="" aria-hidden="true" className="site-brand__logo" />
          <span>2Dto3D<span className="site-brand__tag">POCKET JOY</span></span>
        </Link>

        <nav className="site-nav" aria-label="Điều hướng chính">
          {CUSTOMER_NAV_GROUPS.map(group => {
            const active = isNavigationGroupActive(group.id, location.pathname);
            return <button key={group.id} type="button" ref={node => { triggerRefs.current[group.id] = node; }} className={active ? 'active' : undefined} aria-expanded={openGroup === group.id} aria-controls={openGroup === group.id ? `site-menu-${group.id}` : undefined} aria-current={active ? 'page' : undefined} onClick={() => toggleGroup(group.id)}>{group.label}<HiChevronDown aria-hidden="true" /></button>;
          })}
        </nav>

        <div className="site-header__actions">
          <div className="site-search">
            <button type="button" ref={node => { triggerRefs.current.search = node; }} onClick={() => dispatchOverlay({ type: 'toggle-search' })} aria-label={searchOpen ? 'Đóng tìm kiếm' : 'Tìm sản phẩm'} aria-expanded={searchOpen}>
              {searchOpen ? <HiOutlineXMark size={19} /> : <HiOutlineMagnifyingGlass size={19} />}
            </button>
            {searchOpen && <form className="site-search__form" role="search" onSubmit={submitSearch}><input ref={searchInputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trong cửa hàng" aria-label="Tìm sản phẩm" /><button type="submit">Tìm <HiArrowRight aria-hidden="true" /></button></form>}
          </div>
          <Link to="/cart" className="site-cart" aria-label={`Giỏ hàng${itemCount ? `, ${itemCount} sản phẩm` : ''}`}>
            <HiOutlineShoppingBag size={19} /><span>Giỏ</span>{itemCount > 0 && <span className="site-cart__count">{itemCount}</span>}
          </Link>
          {user ? <div className="site-account">
            <button type="button" ref={node => { triggerRefs.current.account = node; }} className="site-header__account" onClick={() => dispatchOverlay({ type: 'toggle-account' })} aria-expanded={accountOpen} aria-controls={accountOpen ? 'site-account-menu' : undefined}>Tài khoản</button>
            {accountOpen && <div className="site-account__menu" id="site-account-menu" aria-label="Menu tài khoản"><p className="site-account__name">{user.name || 'Tài khoản'}</p>{user.email && <p className="site-account__email">{user.email}</p>}<button type="button" onClick={handleLogout}>Đăng xuất</button></div>}
          </div> : <Link className="site-login" to="/login">Đăng nhập</Link>}
          <button type="button" className="site-header__menu" ref={node => { triggerRefs.current.mobileMenu = node; }} onClick={() => dispatchOverlay({ type: 'toggle-mobile' })} aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={mobileOpen} aria-controls={showMobileMenu ? 'site-mobile-menu' : undefined}>
            {mobileOpen ? <HiOutlineXMark size={20} /> : <HiOutlineBars3 size={20} />}
          </button>
        </div>
      </div>
      {showDesktopMegaMenu && visibleGroup && <RichMegaMenu group={CUSTOMER_NAV_GROUPS.find(group => group.id === visibleGroup)} location={location} onNavigate={() => dispatchOverlay({ type: 'close-all' })} onSearch={() => dispatchOverlay({ type: 'open-search' })} />}

      {showMobileMenu && <div className="site-mobile-menu" id="site-mobile-menu"><nav aria-label="Điều hướng trên thiết bị di động">
          {CUSTOMER_NAV_GROUPS.map(group => <section className="site-mobile-menu__group" key={group.id}><h2><button type="button" aria-expanded={openGroup === group.id} aria-controls={openGroup === group.id ? `site-mobile-group-${group.id}` : undefined} onClick={() => toggleGroup(group.id, true)}>{group.label}<HiChevronDown aria-hidden="true" /></button></h2>{openGroup === group.id && <MobileNavigationCards id={`site-mobile-group-${group.id}`} group={group} location={location} onNavigate={() => dispatchOverlay({ type: 'close-all' })} />}</section>)}
        <button type="button" className="site-mobile-menu__search" onClick={() => dispatchOverlay({ type: 'open-search' })}>Tìm kiếm sản phẩm</button>
      </nav><div className="site-mobile-menu__account">{user ? <button type="button" onClick={handleLogout}>Đăng xuất</button> : <><Link to="/login" onClick={() => dispatchOverlay({ type: 'close-all' })}>Đăng nhập</Link><Link to="/register" onClick={() => dispatchOverlay({ type: 'close-all' })}>Tạo tài khoản</Link></>}</div></div>}
    </header>
  );
}
