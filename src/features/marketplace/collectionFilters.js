export function filterProductsByCollectionAndSearch(products, { collection = '', search = '' } = {}) {
    if (!Array.isArray(products)) return [];

    const query = search.trim().toLocaleLowerCase();

    return products.filter(product => {
        if (collection && !(Array.isArray(product?.collections) && product.collections.includes(collection))) return false;
        if (!query) return true;

        return [product?.title, product?.description, product?.categoryLabel, product?.subcategory]
            .filter(Boolean)
            .some(value => String(value).toLocaleLowerCase().includes(query));
    });
}

export function clearCollectionAndSearchParams(searchParams) {
    const next = new URLSearchParams(searchParams);
    next.delete('collection');
    next.delete('search');
    return next;
}
