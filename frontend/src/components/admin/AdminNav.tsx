import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShieldAlert, MessageSquare, ScrollText,
  LogOut, ExternalLink,
} from 'lucide-react';
import { useAdmin } from '../../context/AdminContext';

/**
 * The admin section's navigation.
 *
 * Rendered once from the Admin route rather than per page, because the section
 * grew past the point where reaching a screen meant going back to the dashboard
 * and clicking a quick action — which is also why the dashboard used
 * `window.location.href` for those jumps and lost the SPA on the way.
 */
const LINKS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/moderation', label: 'Moderation', icon: ShieldAlert },
  { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
  { to: '/admin/logs', label: 'Audit log', icon: ScrollText },
];

export function AdminNav() {
  const { adminLogout } = useAdmin();
  const navigate = useNavigate();

  const signOut = () => {
    adminLogout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="border-b border-border bg-surface">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto py-2">
          <span className="mr-2 hidden shrink-0 font-heading text-sm font-semibold text-deep sm:block">
            Admin
          </span>

          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                // Structural active state — a filled chip, not just a colour nudge.
                `flex shrink-0 items-center gap-2 rounded-button px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-deep text-white'
                    : 'text-muted hover:bg-surface-alt hover:text-deep'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{label}</span>
            </NavLink>
          ))}

          <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">
            <NavLink
              to="/"
              className="flex items-center gap-2 rounded-button px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-alt hover:text-deep"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden whitespace-nowrap sm:inline">View site</span>
            </NavLink>
            <button
              onClick={signOut}
              className="flex cursor-pointer items-center gap-2 rounded-button px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-alt hover:text-deep"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden whitespace-nowrap sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
