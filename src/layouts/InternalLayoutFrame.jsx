import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export default function InternalLayoutFrame({ section, title, description }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-pocket-paper text-pocket-plum md:flex">
      <aside className="border-b border-pocket-line bg-white/80 px-4 py-3 md:min-h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r md:px-5 md:py-6">
        <div className="flex items-center justify-between gap-3 md:block">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">2Dto3D</p>
            <p className="mt-1 text-sm font-semibold">Internal workspace</p>
          </div>
          <span className="rounded-full bg-pocket-lavender/50 px-3 py-1 text-xs font-semibold md:mt-5 md:inline-flex">{section}</span>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-pocket-line bg-white/70 px-4 py-3 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-medium text-slate-500">Internal Management</p>
            <h1 className="text-base font-bold sm:text-lg">{title}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={signOut} aria-label="Đăng xuất">
            <span className="material-symbols-outlined text-base" aria-hidden="true">logout</span>
            <span className="hidden sm:inline">Đăng xuất</span>
          </Button>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <section className="joy-card mx-auto w-full max-w-5xl p-5 sm:p-7" aria-labelledby="internal-page-title">
            <h2 id="internal-page-title" className="text-xl font-bold sm:text-2xl">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
          </section>
        </main>
      </div>
    </div>
  );
}
