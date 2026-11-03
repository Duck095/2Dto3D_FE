import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { STORE_PRODUCTS, PRODUCT_COLLECTIONS } from '../data/productModels';
import { filterProductsByCollectionAndSearch } from '../features/marketplace/collectionFilters';
import { getPublicProducts } from '../features/storefront/productPresentation';
import ProductCard from '../components/storefront/ProductCard';
import './marketplace.css';

const ITEMS_PER_PAGE = 12;

export default function MarketplacePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const activeCollection = searchParams.get('collection') || '';
    const searchQuery = (searchParams.get('search') || '').trim();
    const activeCollectionMeta = PRODUCT_COLLECTIONS.find(collection => collection.id === activeCollection);
    const [searchDraft, setSearchDraft] = useState(searchQuery);
    const [sortOrder, setSortOrder] = useState('name-asc');
    const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

    useEffect(() => {
        setSearchDraft(searchQuery);
        setVisibleCount(ITEMS_PER_PAGE);
    }, [searchQuery, activeCollection]);

    const products = useMemo(() => {
        const publicProducts = getPublicProducts(STORE_PRODUCTS);
        const filtered = filterProductsByCollectionAndSearch(publicProducts, {
            collection: activeCollection,
            search: searchQuery,
        });
        return [...filtered].sort((a, b) => {
            const direction = sortOrder === 'name-desc' ? -1 : 1;
            return direction * a.title.localeCompare(b.title, 'vi');
        });
    }, [activeCollection, searchQuery, sortOrder]);

    const visibleProducts = products.slice(0, visibleCount);
    const hasMore = visibleCount < products.length;

    function updateQuery(nextValues) {
        setSearchParams(current => {
            const next = new URLSearchParams(current);
            for (const [key, value] of Object.entries(nextValues)) {
                if (value) next.set(key, value);
                else next.delete(key);
            }
            return next;
        });
    }

    function submitSearch(event) {
        event.preventDefault();
        updateQuery({ search: searchDraft.trim() });
    }

    function clearFilters() {
        setSearchDraft('');
        updateQuery({ search: '', collection: '' });
        setVisibleCount(ITEMS_PER_PAGE);
    }

    const showingFilteredEmpty = Boolean(searchQuery || activeCollection);

    return (
        <div className="joy-shop">
            <header className="joy-shop__hero">
                <div className="joy-shop__wrap">
                    <span className="joy-shop__eyebrow"><i aria-hidden="true" /> POCKET JOY · THE LITTLE THINGS SHOP</span>
                    <h1>Small things.<br /><span>Big feelings.</span></h1>
                    <p>Móc khóa vui tay, món đồ sưu tầm dễ thương và những món quà mang dấu ấn riêng.</p>
                    <span className="joy-shop__hero-note">Tìm món nhỏ hợp với bạn ✳</span>
                </div>
                <span className="joy-shop__hero-art" aria-hidden="true"><b>✳</b><i>little<br />joy</i><small>POCKET SIZE · BIG MOOD</small></span>
            </header>

            <div className="joy-shop__main">
                <section className="joy-shop__collections" aria-labelledby="collections-title">
                    <div className="joy-shop__section-heading">
                        <div><span className="joy-shop__kicker">FIND YOUR LITTLE THING</span><h2 id="collections-title">Shop by vibe<span>.</span></h2></div>
                        {activeCollectionMeta && <span className="joy-shop__active-collection">{activeCollectionMeta.title}</span>}
                    </div>
                    <nav className="joy-shop__collection-list" aria-label="Bộ sưu tập">
                        <button
                            type="button"
                            aria-pressed={!activeCollection}
                            className={!activeCollection ? 'is-active' : ''}
                            onClick={() => updateQuery({ collection: '' })}
                        >Tất cả bộ sưu tập</button>
                        {PRODUCT_COLLECTIONS.map(collection => (
                            <button
                                type="button"
                                key={collection.id}
                                aria-pressed={activeCollection === collection.id}
                                className={activeCollection === collection.id ? 'is-active' : ''}
                                onClick={() => updateQuery({ collection: collection.id })}
                            >{collection.title}</button>
                        ))}
                    </nav>
                    {activeCollectionMeta && <p className="joy-shop__collection-description">{activeCollectionMeta.description}</p>}
                </section>

                <section className="joy-shop__catalog" aria-labelledby="catalog-title">
                    <div className="joy-shop__catalog-heading">
                        <div><span className="joy-shop__kicker">MADE TO MAKE YOU SMILE</span><h2 id="catalog-title">The collection<span>.</span></h2></div>
                        <span className="joy-shop__result-count">{products.length} sản phẩm</span>
                    </div>

                    <form className="joy-shop__toolbar" role="search" onSubmit={submitSearch}>
                        <label className="joy-shop__search">
                            <span aria-hidden="true">⌕</span>
                            <span className="sr-only">Tìm sản phẩm</span>
                            <input
                                type="search"
                                value={searchDraft}
                                onChange={event => setSearchDraft(event.target.value)}
                                placeholder="Tìm món nhỏ bạn thích..."
                            />
                        </label>
                        <button className="joy-shop-button joy-shop-button--primary" type="submit">Tìm kiếm</button>
                        {products.length > 1 && <label className="joy-shop__sort">
                            <span>Sắp xếp</span>
                            <select value={sortOrder} onChange={event => setSortOrder(event.target.value)}>
                                <option value="name-asc">Tên: A đến Z</option>
                                <option value="name-desc">Tên: Z đến A</option>
                            </select>
                        </label>}
                    </form>

                    {visibleProducts.length > 0 ? (
                        <div className="joy-shop__grid">
                            {visibleProducts.map(product => <ProductCard key={product.id} product={product} />)}
                        </div>
                    ) : (
                        <div className="joy-shop__empty" role="status">
                            <span className="joy-shop__empty-icon" aria-hidden="true">✳</span>
                            <span className="joy-shop__kicker">{showingFilteredEmpty ? 'NOT FOUND YET' : 'COMING WITH JOY'}</span>
                            <h3>{searchQuery
                                ? 'Chưa tìm thấy món nào phù hợp'
                                : activeCollectionMeta
                                    ? 'Bộ sưu tập này chưa có sản phẩm'
                                    : 'Đang chuẩn bị những niềm vui đầu tiên'}</h3>
                            <p>{searchQuery
                                ? 'Thử từ khóa khác hoặc xem toàn bộ bộ sưu tập nhé.'
                                : activeCollectionMeta
                                    ? activeCollectionMeta.description + '. Chúng mình sẽ cập nhật khi có sản phẩm được duyệt.'
                                    : 'Hiện chưa có sản phẩm được duyệt để trưng bày. Ghé lại sau nhé!'}</p>
                            {showingFilteredEmpty && <button type="button" className="joy-shop-button joy-shop-button--secondary" onClick={clearFilters}>Xem tất cả bộ sưu tập</button>}
                            <span className="joy-shop__empty-stamp" aria-hidden="true">TINY<br />THINGS<br />BIG FEELINGS</span>
                        </div>
                    )}

                    {hasMore && <div className="joy-shop__load-more">
                        <button type="button" className="joy-shop-button joy-shop-button--secondary" onClick={() => setVisibleCount(count => count + ITEMS_PER_PAGE)}>Xem thêm sản phẩm</button>
                    </div>}
                </section>
            </div>
        </div>
    );
}
