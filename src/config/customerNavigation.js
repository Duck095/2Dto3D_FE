export const CUSTOMER_NAV_GROUPS = [
    {
        id: 'store',
        label: 'Cửa hàng',
        items: [
            { label: 'Tất cả sản phẩm', to: '/marketplace', description: 'Khám phá cửa hàng Pocket Joy.' },
            { label: 'Clicky & Fidget', to: '/marketplace?collection=clicky-fidget', collection: 'clicky-fidget' },
            { label: 'Cute & Sweet', to: '/marketplace?collection=cute-sweet', collection: 'cute-sweet' },
            { label: 'Characters & Collectibles', to: '/marketplace?collection=characters-collectibles', collection: 'characters-collectibles' },
            { label: 'Quà tặng cá nhân hóa', to: '/marketplace?collection=personalized-gifts', collection: 'personalized-gifts' },
        ],
        richMenu: {
            icon: 'sparkles',
            eyebrow: 'POCKET JOY · TINY THINGS, BIG FEELINGS',
            title: 'Niềm vui nhỏ, luôn bên bạn.',
            description: 'Khám phá móc khóa vui mắt, vui tay và những món quà mang dấu ấn riêng.',
            ctaIndex: 0,
            actions: [
                { itemIndex: 0, icon: 'store', description: 'Xem cửa hàng Pocket Joy.' },
                { itemIndex: 1, icon: 'bolt', description: 'Khám phá nhóm móc khóa vui tay.' },
                { itemIndex: 4, icon: 'gift', description: 'Tìm quà tặng cá nhân hóa.' },
            ],
            discovery: { kind: 'search', icon: 'search', title: 'Bạn đang tìm món gì?', description: 'Tìm trong cửa hàng theo tên hoặc ý tưởng của bạn.', actionLabel: 'Mở tìm kiếm' },
        },
    },
    {
        id: 'ai',
        label: 'Sáng tạo AI',
        items: [
            { label: 'Tạo mô hình từ ảnh', to: '/studio?mode=image', description: 'Bắt đầu với một hình ảnh.' },
            { label: 'Tạo mô hình từ mô tả', to: '/studio?mode=text', description: 'Bắt đầu bằng mô tả bằng văn bản.' },
            { label: 'Xem và tùy chỉnh mô hình 3D', to: '/studio', description: 'Mở AI Studio.' },
        ],
        richMenu: {
            icon: 'sparkles',
            eyebrow: 'AI STUDIO · 2DTO3D',
            title: 'Biến ý tưởng thành mô hình 3D.',
            description: 'Bắt đầu trong AI Studio bằng hình ảnh hoặc mô tả văn bản.',
            ctaIndex: 2,
            actions: [
                { itemIndex: 0, icon: 'photo', description: 'Dùng hình ảnh làm đầu vào cho mô hình 3D.' },
                { itemIndex: 1, icon: 'text', description: 'Mô tả ý tưởng để bắt đầu tạo mô hình 3D.' },
                { itemIndex: 2, icon: 'cube', description: 'Mở khu vực xem và chỉnh sửa mô hình 3D.' },
            ],
            discovery: {
                kind: 'steps', icon: 'route', title: 'Từ ý tưởng đến mô hình', description: 'Quy trình bắt đầu trong AI Studio.',
                steps: ['Chọn ảnh hoặc mô tả', 'Tạo mô hình 3D', 'Xem và tinh chỉnh'],
            },
        },
    },
    {
        id: 'models',
        label: 'Kho mẫu',
        items: [
            { label: 'Thư viện mô hình 3D', to: '/products', description: 'Mô hình công khai đã được duyệt.' },
        ],
        richMenu: {
            icon: 'cube',
            eyebrow: 'THƯ VIỆN 3D · 2DTO3D',
            title: 'Kho mô hình 3D.',
            description: 'Dành cho các mô hình được xác nhận để chia sẻ công khai.',
            ctaIndex: 0,
            actions: [
                { itemIndex: 0, icon: 'cube', description: 'Mở thư viện mô hình 3D công khai.' },
            ],
            discovery: { kind: 'empty', icon: 'sparkles', title: 'Chưa có mô hình công khai được duyệt', description: 'Thư viện sẽ hiển thị mô hình khi trạng thái chia sẻ công khai đã được xác nhận.' },
        },
    },
    {
        id: 'guides',
        label: 'Hướng dẫn',
        items: [
            { label: 'Bắt đầu sử dụng 2Dto3D', to: '/workflow' },
            { label: 'Tạo mô hình từ ảnh', to: '/studio?mode=image' },
            { label: 'Tạo mô hình từ mô tả', to: '/studio?mode=text' },
            { label: 'Quy trình chuẩn bị in 3D', to: '/workflow#quy-trinh-in' },
            { label: 'Câu hỏi thường gặp', disabled: true, disabledReason: 'Nội dung đang được xác minh.' },
        ],
        richMenu: {
            icon: 'book',
            eyebrow: 'HƯỚNG DẪN · 2DTO3D',
            title: 'Bắt đầu theo cách của bạn.',
            description: 'Xem các bước sử dụng hiện có từ ý tưởng đến bản nháp mô hình.',
            ctaIndex: 0,
            actions: [
                { itemIndex: 0, icon: 'book', description: 'Các bước hiện có trên nền tảng.' },
                { itemIndex: 1, icon: 'photo', description: 'Bắt đầu tạo mô hình 3D từ ảnh.' },
                { itemIndex: 2, icon: 'text', description: 'Bắt đầu tạo mô hình 3D từ mô tả.' },
                { itemIndex: 3, icon: 'printer', description: 'Tìm hiểu bước chuẩn bị cho quy trình in.' },
            ],
            discovery: { kind: 'note', icon: 'info', title: 'Nội dung được xác minh', description: 'Câu hỏi thường gặp đang được rà soát nên chưa có liên kết công khai.' },
        },
    },
    {
        id: 'printing',
        label: 'Dịch vụ in 3D',
        items: [
            { label: 'Bắt đầu chuẩn bị mô hình', to: '/studio' },
            { label: 'Tìm hiểu quy trình in', to: '/workflow#quy-trinh-in' },
            { label: 'Hướng dẫn cấu hình in', disabled: true, disabledReason: 'Hướng dẫn chưa sẵn sàng.' },
            {
                label: 'Xem ước tính từ bản nháp',
                to: '/print-quote',
                requiresPrintDraft: true,
                disabledReason: 'Cần mở từ một bản nháp trong AI Studio.',
            },
        ],
        richMenu: {
            icon: 'printer',
            eyebrow: 'DỊCH VỤ IN 3D · 2DTO3D',
            title: 'Từ mô hình đến bước chuẩn bị in.',
            description: 'Bắt đầu bằng một bản nháp trong AI Studio và tìm hiểu quy trình hiện có.',
            ctaIndex: 0,
            actions: [
                { itemIndex: 0, icon: 'cube', description: 'Mở AI Studio để bắt đầu hoặc tiếp tục với mô hình.' },
                { itemIndex: 1, icon: 'book', description: 'Đọc quy trình chuẩn bị in hiện có.' },
                { itemIndex: 2, icon: 'adjust', description: 'Hướng dẫn cấu hình chưa sẵn sàng.' },
                { itemIndex: 3, icon: 'calculator', description: 'Chỉ mở ước tính từ bản nháp phù hợp; đây chưa phải đơn in.' },
            ],
            discovery: {
                kind: 'steps', icon: 'route', title: 'Các bước chuẩn bị', description: 'Ước tính chỉ tham khảo và không gửi yêu cầu đặt in.',
                steps: ['Chuẩn bị mô hình', 'Tìm hiểu cấu hình', 'Xem ước tính từ bản nháp'],
            },
        },
    },
    {
        id: 'about',
        label: 'Về chúng tôi',
        items: [
            { label: 'Nền tảng 2Dto3D', to: '/about#nen-tang' },
            { label: 'Pocket Joy', to: '/about#pocket-joy' },
            { label: 'Từ ý tưởng đến mô hình', to: '/about#quy-trinh' },
        ],
        richMenu: {
            icon: 'heart',
            eyebrow: 'VỀ 2DTO3D',
            title: 'Công cụ 3D và niềm vui nhỏ.',
            description: 'Tìm hiểu nền tảng 2Dto3D, dòng Pocket Joy và quy trình hiện tại.',
            ctaIndex: 0,
            actions: [
                { itemIndex: 0, icon: 'cube', description: 'Tìm hiểu định hướng nền tảng.' },
                { itemIndex: 1, icon: 'heart', description: 'Khám phá ý tưởng Pocket Joy.' },
                { itemIndex: 2, icon: 'route', description: 'Xem các bước từ ý tưởng đến mô hình.' },
            ],
            discovery: {
                kind: 'facts', icon: 'sparkles', title: 'Tìm hiểu thêm', description: 'Các liên kết dẫn đến nội dung đang có trên trang Về chúng tôi.',
                links: [{ label: 'Nền tảng 2Dto3D', itemIndex: 0 }, { label: 'Pocket Joy', itemIndex: 1 }, { label: 'Quy trình', itemIndex: 2 }],
            },
        },
    },
];

export function isNavigationGroupActive(groupId, pathname) {
    if (groupId === 'store') return pathname === '/marketplace' || pathname.startsWith('/product/');
    if (groupId === 'ai') return pathname === '/studio';
    if (groupId === 'models') return pathname === '/products';
    if (groupId === 'guides') return pathname === '/workflow' || pathname === '/resources';
    if (groupId === 'printing') return pathname === '/print-quote';
    if (groupId === 'about') return pathname === '/about';
    return false;
}

export function getNavigationState(to, currentState) {
    if (to?.startsWith('/studio') && currentState?.modelEditDraft) return currentState;
    if (to === '/print-quote' && currentState?.printDraft) return currentState;
    return undefined;
}

export function getNavigationPresentation({ compact, mobileOpen, openGroup }) {
    const showMobileMenu = Boolean(compact && mobileOpen);
    const showDesktopMegaMenu = Boolean(!compact && openGroup);
    return {
        showDesktopMegaMenu,
        showMobileMenu,
        visibleGroup: showDesktopMegaMenu || showMobileMenu ? openGroup : null,
    };
}

export function transitionNavigationOverlay(state, action) {
    const closed = { mobileOpen: false, openGroup: null, searchOpen: false, accountOpen: false };
    switch (action.type) {
        case 'open-group': {
            const openGroup = state.openGroup === action.groupId ? null : action.groupId;
            return { ...closed, mobileOpen: Boolean(action.compact && state.mobileOpen), openGroup };
        }
        case 'toggle-mobile':
            return state.mobileOpen ? closed : { ...closed, mobileOpen: true };
        case 'toggle-search':
            return state.searchOpen ? { ...state, searchOpen: false } : { ...closed, searchOpen: true };
        case 'open-search':
            return { ...closed, searchOpen: true };
        case 'toggle-account':
            return state.accountOpen ? { ...state, accountOpen: false } : { ...closed, accountOpen: true };
        case 'open-account':
            return { ...closed, accountOpen: true };
        case 'close-all':
            return closed;
        default:
            return state;
    }
}

export function isNavigationItemActive(item, location) {
    if (!item?.to || item.disabled) return false;
    const [path, targetHash = ''] = item.to.split('#');
    const [targetPath, targetSearch = ''] = path.split('?');
    if (targetPath !== location.pathname) return false;
    if (targetHash) return location.hash === `#${targetHash}`;

    const current = new URLSearchParams(location.search);
    const target = new URLSearchParams(targetSearch);
    for (const [key, value] of target) {
        if (current.get(key) !== value) return false;
    }

    if (item.collection) return current.get('collection') === item.collection;
    if (targetSearch) return true;
    if (targetPath === '/marketplace') return !current.has('collection') && !current.has('search');
    return current.toString() === '';
}

export function isNavigationItemAvailable(item, location) {
    return Boolean(item && !item.disabled && (!item.requiresPrintDraft || location?.state?.printDraft));
}
