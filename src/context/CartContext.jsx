import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { STORE_PRODUCTS } from '../data/productModels';
import { createCartItemSnapshot, findPublicProduct } from '../features/storefront/productPresentation';
import { persistCart, restoreCart } from './cartStorage';
import { mergeExistingCartItem } from './cartState';

const CartContext = createContext(null);

function getBrowserStorage() {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}

function loadCart() {
    const restored = restoreCart(getBrowserStorage(), STORE_PRODUCTS);
    const messages = [];
    if (restored.invalidCount > 0) {
        if (restored.backupStatus === 'saved') {
            messages.push(`${restored.invalidCount} mục giỏ cũ không hợp lệ đã được loại khỏi giỏ hoạt động và sao lưu tạm trong vùng khôi phục có giới hạn.`);
        } else {
            const reason = {
                'record-too-large': 'Bản ghi vượt quá giới hạn 64 KiB.',
                'quarantine-unreadable': 'Vùng bản sao lưu hiện tại không đọc được.',
                'storage-denied': 'Thiết bị từ chối lưu bản sao lưu đầy đủ.',
            }[restored.backupStatus] || 'Không thể lưu bản sao lưu đầy đủ.';
            messages.push(`${restored.invalidCount} mục giỏ cũ không hợp lệ đã bị loại khỏi giỏ hoạt động nhưng chưa sao lưu được. ${reason} Dữ liệu gốc vẫn được giữ nguyên.`);
        }
    }
    if (restored.updatedPriceCount > 0) {
        messages.push('Giá của một số sản phẩm đã được cập nhật theo catalog hiện tại.');
    }
    if (restored.migrationBlocked && restored.invalidCount === 0) {
        messages.push('Không thể đọc dữ liệu cart trên thiết bị. Dữ liệu gốc sẽ không bị ghi đè.');
    }
    return { ...restored, notice: messages.join(' ') || null };
}

export function CartProvider({ children }) {
    const [initialCart] = useState(loadCart);
    const [items, setItems] = useState(initialCart.items);
    const [cartNotice, setCartNotice] = useState(initialCart.notice);
    const [migrationBlocked, setMigrationBlocked] = useState(initialCart.migrationBlocked);

    useEffect(() => {
        if (migrationBlocked) return;
        if (!persistCart(getBrowserStorage(), items)) {
            setCartNotice(initialCart.backupStatus === 'saved'
                ? 'Bản dự phòng giỏ cũ đã được lưu, nhưng chưa thể cập nhật giỏ hoạt động trên thiết bị.'
                : 'Không thể lưu thay đổi giỏ hàng trên thiết bị này.');
        }
    }, [items, migrationBlocked, initialCart.backupStatus]);

    function addItem(product, selection = {}) {
        const cartItem = createCartItemSnapshot(product, selection);
        if (!cartItem) return false;

        setItems(current => mergeExistingCartItem(current, cartItem));
        return true;
    }

    function updateQuantity(key, quantity) {
        if (quantity === 0) {
            removeItem(key);
            return;
        }
        if (!Number.isSafeInteger(quantity) || quantity < 1) return;
        setItems(current => current.flatMap(item => {
            if (item.key !== key) return [item];
            const product = findPublicProduct(STORE_PRODUCTS, item.productId);
            const updated = product && createCartItemSnapshot(product, {
                option: item.variantId === 'default' ? null : { id: item.variantId },
                material: item.materialId == null || item.materialId === 'default' ? null : { id: item.materialId },
                quantity,
            });
            return updated ? [updated] : [];
        }));
    }

    function removeItem(key) {
        setItems(current => current.filter(item => item.key !== key));
    }

    function clearCart() {
        setItems([]);
    }

    function replaceUnmigratedCart() {
        if (!persistCart(getBrowserStorage(), items)) {
            setCartNotice('Không thể thay thế dữ liệu giỏ cũ trên thiết bị; dữ liệu gốc vẫn được giữ nguyên.');
            return false;
        }
        setMigrationBlocked(false);
        setCartNotice('Dữ liệu giỏ cũ đã được thay thế bằng các mục đã xác thực hiện tại.');
        return true;
    }

    const value = useMemo(() => ({
        items,
        itemCount: items.reduce((total, item) => total + item.quantity, 0),
        cartNotice,
        migrationBlocked,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        replaceUnmigratedCart,
        dismissCartNotice: () => setCartNotice(null),
    }), [items, cartNotice, migrationBlocked]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within CartProvider');
    return context;
}
