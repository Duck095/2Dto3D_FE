import FloatingShapes from '../components/FloatingShapes';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Outlet, useLocation } from 'react-router-dom';

export default function MainLayout() {
    const isHome = useLocation().pathname === '/';
    return (
        <div className={`site-layout relative min-h-screen overflow-x-hidden noise-overlay${isHome ? ' site-layout--home' : ''}`}>
            {/* Soft Pocket Joy backdrop for customer routes */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden home-backdrop">
                <div className="absolute -top-[15%] -left-[10%] w-[700px] h-[700px] rounded-full" style={{ background: 'radial-gradient(circle, var(--joy-lavender), transparent 70%)', opacity: 0.12, filter: 'blur(80px)' }} />
                <div className="absolute -bottom-[10%] -right-[8%] w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, var(--joy-pink), transparent 70%)', opacity: 0.1, filter: 'blur(80px)' }} />
                <div className="absolute top-[40%] right-[20%] w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, var(--joy-mint), transparent 70%)', opacity: 0.08, filter: 'blur(90px)' }} />
                <div className="absolute bottom-[25%] left-[10%] w-[350px] h-[350px] rounded-full" style={{ background: 'radial-gradient(circle, var(--joy-butter), transparent 70%)', opacity: 0.07, filter: 'blur(70px)' }} />
            </div>

            {/* Background floating 3D shapes */}
            {!isHome && <div className="home-floating-shapes"><FloatingShapes /></div>}

            {/* UI Layer */}
            <div className="relative z-[1]">
                <Navbar />
                <main>
                    <Outlet />
                </main>
                <Footer />
            </div>
        </div>
    );
}
