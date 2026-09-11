import { NavLink, useNavigate } from 'react-router-dom';
import {
  Inbox, Zap, Settings, MessageSquare, LogOut
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';



interface SidebarProps { unreadCount?: number; }

export default function Sidebar({ unreadCount = 0 }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">O</div>

      <nav className="sidebar-nav">
        <NavLink to="/inbox" title="Inbox">
          {({ isActive }) => (
            <button className={`sidebar-btn ${isActive ? 'active' : ''}`}>
              <Inbox size={18} />
              {unreadCount > 0 && (
                <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>
          )}
        </NavLink>

        <NavLink to="/automation" title="Automation Engine">
          {({ isActive }) => (
            <button className={`sidebar-btn ${isActive ? 'active' : ''}`}>
              <Zap size={18} />
            </button>
          )}
        </NavLink>

        <NavLink to="/platforms" title="Platforms">
          {({ isActive }) => (
            <button className={`sidebar-btn ${isActive ? 'active' : ''}`}>
              <MessageSquare size={18} />
            </button>
          )}
        </NavLink>
      </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <NavLink to="/settings" title="Settings">
          {({ isActive }) => (
            <button className={`sidebar-btn ${isActive ? 'active' : ''}`}>
              <Settings size={18} />
            </button>
          )}
        </NavLink>

        <button
          className="sidebar-btn"
          title="Log out"
          onClick={() => { logout(); navigate('/login'); }}
        >
          <LogOut size={16} />
        </button>

        <div
          className="sidebar-avatar"
          title={user?.full_name}
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: 13,
          }}
        >
          {initials}
        </div>
      </div>
    </aside>
  );
}
