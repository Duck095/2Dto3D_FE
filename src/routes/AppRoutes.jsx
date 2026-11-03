// ─────────────────────────────────────────────
// Morphia — Application Router
//
// • Heavy pages (AI Studio, Product Detail, Print Quote) are lazy-loaded
// • Checkout is public and currently displays an unavailable status only
// • Studio is public but Generate action requires login (handled in page)
// • Cart is public (guest cart via localStorage)
// ─────────────────────────────────────────────

import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout.jsx';
import PageSpinner from '../components/ui/PageSpinner.jsx';
import InternalAccessGuard from './InternalAccessGuard.jsx';
import AdminLayout from '../layouts/AdminLayout.jsx';
import EmployeeLayout from '../layouts/EmployeeLayout.jsx';
import AdminOverviewPage from '../pages/admin/AdminOverviewPage.jsx';

// ── Eager-loaded pages (small, frequently visited) ──
import HomePage from '../pages/HomePage.jsx';
import MarketplacePage from '../pages/MarketplacePage.jsx';
import ProductsPage from '../pages/ProductsPage.jsx';
import WorkflowPage from '../pages/WorkflowPage.jsx';
import PricingPage from '../pages/PricingPage.jsx';
import ResourcesPage from '../pages/ResourcesPage.jsx';
import AboutPage from '../pages/AboutPage.jsx';
import AuthPage from '../pages/AuthPage.jsx';
import CartPage from '../pages/CartPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

// ── Lazy-loaded pages (heavy: Three.js, AI Studio, Print Quote) ──
const AIStudioPage = lazy(() => import('../pages/AIStudioPage.jsx'));
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage.jsx'));
const PrintQuotePage = lazy(() => import('../pages/PrintQuotePage.jsx'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage.jsx'));
const StaffManagementPage = lazy(() => import('../pages/admin/StaffManagementPage.jsx'));

/** Suspense wrapper for lazy pages */
function LazyPage({ children }) {
  return <Suspense fallback={<PageSpinner />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      // ── Public routes ────────────────────
      { index: true, element: <HomePage /> },
      { path: 'marketplace', element: <MarketplacePage /> },
      {
        path: 'product/:id',
        element: <LazyPage><ProductDetailPage /></LazyPage>,
      },
      {
        path: 'studio',
        element: <LazyPage><AIStudioPage /></LazyPage>,
      },
      {
        path: 'print-quote',
        element: <LazyPage><PrintQuotePage /></LazyPage>,
      },
      { path: 'products', element: <ProductsPage /> },
      { path: 'workflow', element: <WorkflowPage /> },
      { path: 'pricing', element: <PricingPage /> },
      { path: 'resources', element: <ResourcesPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'login', element: <AuthPage key="login" mode="login" /> },
      { path: 'register', element: <AuthPage key="register" mode="register" /> },
      { path: 'cart', element: <CartPage /> },

      // ── Checkout status ───────────────────
      {
        path: 'checkout',
        element: <LazyPage><CheckoutPage /></LazyPage>,
      },

      // ── Catch-all ────────────────────────
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <InternalAccessGuard requiredContext="ADMIN"><AdminLayout /></InternalAccessGuard>,
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: 'staff', element: <LazyPage><StaffManagementPage /></LazyPage> },
    ],
  },
  {
    path: '/employee',
    element: <InternalAccessGuard requiredContext="EMPLOYEE"><EmployeeLayout /></InternalAccessGuard>,
  },
]);
