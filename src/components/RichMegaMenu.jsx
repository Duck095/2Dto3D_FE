import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowUpRight,
  HiOutlineBolt,
  HiOutlineBookOpen,
  HiOutlineBuildingStorefront,
  HiOutlineCalculator,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlineGift,
  HiOutlineHeart,
  HiOutlineInformationCircle,
  HiOutlineLightBulb,
  HiOutlineMagnifyingGlass,
  HiOutlinePhoto,
  HiOutlinePrinter,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { Link } from 'react-router-dom';
import { getNavigationState, isNavigationItemActive, isNavigationItemAvailable } from '../config/customerNavigation';

const ICONS = {
  adjust: HiOutlineAdjustmentsHorizontal,
  bolt: HiOutlineBolt,
  book: HiOutlineBookOpen,
  calculator: HiOutlineCalculator,
  chat: HiOutlineChatBubbleLeftRight,
  cube: HiOutlineCube,
  document: HiOutlineDocumentText,
  gift: HiOutlineGift,
  heart: HiOutlineHeart,
  info: HiOutlineInformationCircle,
  lightbulb: HiOutlineLightBulb,
  printer: HiOutlinePrinter,
  photo: HiOutlinePhoto,
  search: HiOutlineMagnifyingGlass,
  sparkles: HiOutlineSparkles,
  store: HiOutlineBuildingStorefront,
};

function Icon({ name, className = '' }) {
  const Component = ICONS[name] || HiOutlineSparkles;
  return <Component className={className} aria-hidden="true" focusable="false" />;
}

function itemDestination(to) {
  const [path, hash = ''] = to.split('#');
  const [pathname, search = ''] = path.split('?');
  return { pathname, search: search ? `?${search}` : '', hash: hash ? `#${hash}` : '' };
}

function NavigationCard({ item, location, icon, description, onNavigate, compact = false, primary = false }) {
  const disabled = !isNavigationItemAvailable(item, location);
  const active = isNavigationItemActive(item, location);
  const reason = disabled ? item.disabledReason || 'Mục này hiện chưa khả dụng.' : null;
  const cardClass = `rich-menu-card${compact ? ' rich-menu-card--compact' : ''}${primary ? ' rich-menu-card--primary' : ''}${disabled ? ' is-disabled' : ''}${active ? ' active' : ''}`;
  const content = (
    <>
      <span className="rich-menu-card__icon"><Icon name={icon} /></span>
      <span className="rich-menu-card__copy">
        <span className="rich-menu-card__title">{item.label}</span>
        {(description || item.description) && <small>{description || item.description}</small>}
        {reason && <small className="rich-menu-card__reason">{reason}</small>}
      </span>
      {!disabled && <HiOutlineArrowUpRight className="rich-menu-card__arrow" aria-hidden="true" />}
    </>
  );

  if (disabled) return <span className={cardClass} aria-disabled="true">{content}</span>;
  return (
    <Link
      className={cardClass}
      to={itemDestination(item.to)}
      state={getNavigationState(item.to, location.state)}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    >{content}</Link>
  );
}

function DiscoveryPanel({ discovery, group, location, onSearch, onNavigate }) {
  return (
    <aside className={`rich-menu-discovery rich-menu-discovery--${discovery.kind}`} aria-label={discovery.title} role={discovery.kind === 'empty' ? 'status' : undefined}>
      <div className="rich-menu-discovery__icon"><Icon name={discovery.icon} /></div>
      <p className="rich-menu-eyebrow">{discovery.kind === 'empty' ? 'TÌNH TRẠNG THƯ VIỆN' : 'KHÁM PHÁ THÊM'}</p>
      <h3>{discovery.title}</h3>
      <p className="rich-menu-discovery__description">{discovery.description}</p>

      {discovery.kind === 'search' && <button type="button" className="rich-menu-search" onClick={onSearch}><Icon name="search" /><span>{discovery.actionLabel || 'Mở tìm kiếm'}</span><HiOutlineArrowUpRight aria-hidden="true" /></button>}

      {discovery.kind === 'steps' && <ol className="rich-menu-steps">{discovery.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol>}

      {discovery.kind === 'empty' && <div className="rich-menu-empty"><span aria-hidden="true">◇</span><span>Chưa có mẫu nào để trưng bày.</span></div>}

      {discovery.kind === 'note' && <div className="rich-menu-note"><Icon name="info" /><span>Nội dung chỉ được liên kết khi đã sẵn sàng.</span></div>}

      {discovery.kind === 'facts' && <div className="rich-menu-facts">{discovery.links.map(({ label, itemIndex }) => {
        const item = group.items[itemIndex];
        return <NavigationCard key={label} item={{ ...item, label }} location={location} icon={group.richMenu.icon} compact onNavigate={onNavigate} />;
      })}</div>}
    </aside>
  );
}

export default function RichMegaMenu({ group, location, onNavigate, onSearch }) {
  const menu = group.richMenu;
  const cta = group.items[menu.ctaIndex];
  return (
    <div className="site-mega-menu" id={`site-menu-${group.id}`} role="region" aria-label={group.label}>
      <div className="site-mega-menu__inner rich-mega-menu">
        <section className={`rich-menu-feature rich-menu-feature--${group.id}`}>
          <div className="rich-menu-feature__ornament rich-menu-feature__ornament--one" aria-hidden="true" />
          <div className="rich-menu-feature__ornament rich-menu-feature__ornament--two" aria-hidden="true" />
          <div className="rich-menu-feature__icon"><Icon name={menu.icon} /></div>
          <p className="rich-menu-eyebrow">{menu.eyebrow}</p>
          <h2>{menu.title}</h2>
          <p className="rich-menu-feature__description">{menu.description}</p>
          <NavigationCard item={cta} location={location} icon={menu.icon} description="Đi đến khu vực này" primary onNavigate={onNavigate} />
          <span className="rich-menu-feature__sparkle" aria-hidden="true">✳</span>
        </section>

        <section className="rich-menu-actions" aria-label="Các lựa chọn">
          <p className="rich-menu-eyebrow">LỰA CHỌN DÀNH CHO BẠN</p>
          <h3>Khám phá nhanh</h3>
          <div className="rich-menu-actions__grid">
            {menu.actions.map(({ itemIndex, icon, description }) => <NavigationCard
              key={`${itemIndex}-${icon}`}
              item={group.items[itemIndex]}
              location={location}
              icon={icon}
              description={description}
              onNavigate={onNavigate}
            />)}
          </div>
        </section>

        <DiscoveryPanel discovery={menu.discovery} group={group} location={location} onSearch={onSearch} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

export function MobileNavigationCards({ id, group, location, onNavigate }) {
  const actionByIndex = new Map(group.richMenu.actions.map(action => [action.itemIndex, action]));
  return <div id={id} className="site-mobile-menu__items rich-mobile-cards">{group.items.map((item, itemIndex) => {
    const action = actionByIndex.get(itemIndex);
    return <NavigationCard
      key={`${item.to || item.label}-${itemIndex}`}
      item={item}
      location={location}
      icon={action?.icon || 'sparkles'}
      description={action?.description || item.description || (item.collection ? 'Xem các sản phẩm trong bộ sưu tập này.' : undefined)}
      onNavigate={onNavigate}
      compact
    />;
  })}</div>;
}
