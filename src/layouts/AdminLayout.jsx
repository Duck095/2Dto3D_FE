import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { ADMIN_NAVIGATION } from '../config/adminNavigation';
import { useAuth } from '../context/AuthContext';
import '../styles/admin-workspace.css';

export default function AdminLayout() {
  const { logout, currentUser, currentUserStatus } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  );
  const menuToggleRef = useRef(null);
  const closeButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const mainColumnRef = useRef(null);
  const skipLinkRef = useRef(null);
  const mobileDialogOpen = mobileNavOpen && isMobileViewport;
  const verifiedIdentity = currentUserStatus === 'verified' ? currentUser : null;
  const displayName = typeof verifiedIdentity?.name === 'string' && verifiedIdentity.name.trim()
    ? verifiedIdentity.name.trim()
    : 'Tài khoản quản trị';
  const displayEmail = typeof verifiedIdentity?.email === 'string' ? verifiedIdentity.email.trim() : '';

  useEffect(() => {
    if (mobileDialogOpen) closeButtonRef.current?.focus();
  }, [mobileDialogOpen]);

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 767px)');
    const handleViewportChange = (event) => {
      setIsMobileViewport(event.matches);
      if (!event.matches) {
        setMobileNavOpen(false);
        window.requestAnimationFrame(() => {
          if (document.activeElement === closeButtonRef.current) {
            sidebarRef.current?.querySelector('.admin-brand')?.focus();
          }
        });
      }
    };

    mobileViewport.addEventListener('change', handleViewportChange);
    return () => mobileViewport.removeEventListener('change', handleViewportChange);
  }, []);

  useLayoutEffect(() => {
    [mainColumnRef.current, skipLinkRef.current].forEach(element => {
      if (!element) return;
      if (mobileDialogOpen) element.setAttribute('inert', '');
      else element.removeAttribute('inert');
    });
  }, [mobileDialogOpen]);

  const closeMobileNavigation = () => {
    setMobileNavOpen(false);
    window.requestAnimationFrame(() => {
      if (window.matchMedia('(max-width: 767px)').matches) menuToggleRef.current?.focus();
    });
  };

  const handleNavigationKeyDown = (event) => {
    if (!mobileDialogOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMobileNavigation();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusableItems = sidebarRef.current?.querySelectorAll('a[href],button:not(:disabled)');
    if (!focusableItems?.length) return;

    const firstItem = focusableItems[0];
    const lastItem = focusableItems[focusableItems.length - 1];
    if (event.shiftKey && (document.activeElement === firstItem || !sidebarRef.current.contains(document.activeElement))) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && (document.activeElement === lastItem || !sidebarRef.current.contains(document.activeElement))) {
      event.preventDefault();
      firstItem.focus();
    }
  };

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="admin-workspace">
      <a ref={skipLinkRef} className="admin-skip-link" href="#admin-main-content" aria-hidden={mobileDialogOpen}>
        Bỏ qua điều hướng
      </a>

      {mobileDialogOpen && (
        <div
          className="admin-navigation-backdrop"
          aria-hidden="true"
          onClick={closeMobileNavigation}
        />
      )}

      <div className="admin-shell">
        <aside
          id="admin-navigation"
          ref={sidebarRef}
          className="admin-sidebar"
          data-open={mobileDialogOpen}
          aria-label="Điều hướng quản trị"
          role={mobileDialogOpen ? 'dialog' : undefined}
          aria-modal={mobileDialogOpen ? true : undefined}
          onKeyDown={handleNavigationKeyDown}
        >
          <div className="admin-sidebar__brand-row">
            <a
              className="admin-brand"
              href="#admin-main-content"
              aria-label="2Dto3D Admin, về nội dung chính"
              onClick={() => { if (mobileDialogOpen) closeMobileNavigation(); }}
            >
              <span className="admin-brand__mark" aria-hidden="true">3D</span>
              <span className="admin-brand__copy">
                <strong>2Dto3D</strong>
                <small>ADMIN WORKSPACE</small>
              </span>
            </a>
            <button
              ref={closeButtonRef}
              className="admin-sidebar__close"
              type="button"
              aria-label="Đóng menu quản trị"
              onClick={closeMobileNavigation}
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <nav className="admin-primary-nav" aria-label="Các khu vực quản trị">
            {ADMIN_NAVIGATION.map(group => (
              <section className="admin-nav-group" key={group.id} aria-labelledby={`admin-nav-group-${group.id}`}>
                <h2 id={`admin-nav-group-${group.id}`} className="admin-nav-group__title">{group.label}</h2>
                <ul className="admin-nav-group__items">
                  {group.items.map(item => (
                    <li key={item.id}>
                      {item.to ? (
                        <NavLink
                          to={item.to}
                          end
                          className={({ isActive }) => `admin-nav-item${isActive ? ' is-active' : ''}`}
                          onClick={() => { if (mobileDialogOpen) closeMobileNavigation(); }}
                        >
                          <span className="admin-nav-item__marker" aria-hidden="true" />
                          <span className="admin-nav-item__label">{item.label}</span>
                        </NavLink>
                      ) : (
                        <button
                          className="admin-nav-item admin-nav-item--unavailable"
                          type="button"
                          disabled={!item.available}
                          aria-label={`${item.label} — Chưa khả dụng`}
                          title="Mục này chưa có màn hình được triển khai"
                        >
                          <span className="admin-nav-item__marker" aria-hidden="true" />
                          <span className="admin-nav-item__label">{item.label}</span>
                          <span className="admin-nav-item__availability">Chưa khả dụng</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>

          <div className="admin-sidebar__footer">
            <span className="admin-verified-dot" aria-hidden="true" />
            <span>Quyền Admin đã xác minh</span>
          </div>
        </aside>

        <div ref={mainColumnRef} className="admin-main-column" aria-hidden={mobileDialogOpen}>
          <header className="admin-topbar">
            <button
              ref={menuToggleRef}
              className="admin-menu-toggle"
              type="button"
              aria-label={mobileDialogOpen ? 'Đóng menu quản trị' : 'Mở menu quản trị'}
              aria-expanded={mobileDialogOpen}
              aria-controls="admin-navigation"
              onClick={() => setMobileNavOpen(open => !open)}
            >
              <span aria-hidden="true">☰</span>
            </button>

            <div className="admin-topbar__context">
              <p>2Dto3D <span aria-hidden="true">/</span> Admin</p>
              <h1>Admin Workspace</h1>
            </div>

            <div className="admin-account">
              <div className="admin-account__identity">
                <strong>{displayName}</strong>
                {displayEmail && <span>{displayEmail}</span>}
              </div>
              <span className="admin-account__verified" aria-label="Danh tính đã được Backend xác minh">Đã xác minh</span>
              <Button className="admin-logout" variant="outline" size="sm" onClick={handleSignOut}>
                Đăng xuất
              </Button>
            </div>
          </header>

          <main id="admin-main-content" className="admin-main-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
