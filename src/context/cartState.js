export function mergeExistingCartItem(currentItems, nextItem) {
    if (!nextItem || !Number.isSafeInteger(nextItem.quantity) || nextItem.quantity < 1) return currentItems;
    const existingIndex = currentItems.findIndex(item => item.key === nextItem.key);
    if (existingIndex < 0) return [...currentItems, nextItem];

    const existing = currentItems[existingIndex];
    const quantity = existing.quantity + nextItem.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1) return currentItems;

    return currentItems.map((item, index) => index === existingIndex
        ? { ...nextItem, quantity }
        : item);
}
