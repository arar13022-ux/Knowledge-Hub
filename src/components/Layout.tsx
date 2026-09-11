import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import clsx from 'clsx';

const navItem =
  'px-3 py-2 rounded-lg text-sm font-medium transition-colors text-ink-700 dark:text-paper-100/80 hover:bg-paper-100 dark:hover:bg-ink-800';
const navItemActive = 'bg-signal-teal/10 text-signal-teal dark:text-signal-teal';

export default function Layout() {
  const { profile, signOut, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-paper-50 dark:bg-ink-950 font-body text-ink-900 dark:text-paper-50">
      <header className="border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-ink-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-8">
            <span className="font-display font-bold text-lg tracking-tight">
              Knowledge<span className="text-signal-teal">Hub</span>
            </span>
            <nav className="flex gap-1">
              <NavLink to="/" end className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
                Knowledge base
              </NavLink>
              <NavLink to="/ask" className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
                Ask a question
              </NavLink>
              {hasRole('team_lead', 'admin') && (
                <NavLink to="/queue" className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
                  Review queue
                </NavLink>
              )}
              {hasRole('team_lead', 'admin') && (
                <NavLink to="/analytics" className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
                  Analytics
                </NavLink>
              )}
              {hasRole('admin') && (
                <NavLink to="/admin" className={({ isActive }) => clsx(navItem, isActive && navItemActive)}>
                  Admin
                </NavLink>
              )}
              {hasRole('team_lead', 'admin') && ( <NavLink to="/feedback" className={({ isActive }) => clsx(navItem, isActive && navItemActive)}> Feedback </NavLink> )}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-full grid place-items-center hover:bg-paper-100 dark:hover:bg-ink-800 transition-colors"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{profile?.fullName}</div>
              <div className="text-xs text-ink-700/60 dark:text-paper-100/50 capitalize">
                {profile?.role.replace('_', ' ')}
              </div>
            </div>
            <button onClick={() => signOut()} className="text-sm text-ink-700/70 dark:text-paper-100/60 hover:underline">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
        <footer className="max-w-6xl mx-auto px-6 py-6 text-center text-xs text-ink-700/40 dark:text-paper-100/30"> Clarity, shared. · Built by Abdullah Hany </footer>
      </main>
    </div>
  );
}
