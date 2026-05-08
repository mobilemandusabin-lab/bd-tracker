import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  ClipboardList, 
  BarChart3, 
  LogOut,
  Bell,
  ChevronRight,
  ShieldCheck,
  Settings,
  PieChart,
  Menu,
  X,
  Target,
  MessageSquare,
  ShoppingBag
} from 'lucide-react';
import { cn } from '../utils/cn';
import NotificationBell from '../components/NotificationBell';

const SidebarLink = ({ to, icon: Icon, label, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link 
      to={to} 
      onClick={onClick}
      className={cn(
        "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
        isActive 
          ? "bg-red-50 text-red-600 shadow-sm" 
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} className={cn(isActive ? "text-red-600" : "text-slate-400 group-hover:text-slate-600")} />
        <span className="font-bold text-sm">{label}</span>
      </div>
      {isActive && <ChevronRight size={16} className="text-red-400" />}
    </Link>
  );
};

const Layout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, token } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-100 z-[40] flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="bg-red-600 p-1.5 rounded-lg">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <h1 className="text-lg font-black tracking-tight text-slate-900">
            BD <span className="text-red-600 uppercase">Tracker</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <NotificationBell token={token} />
          <button 
            onClick={toggleMobileMenu}
            className="p-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45]"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-72 bg-white border-r border-slate-100 flex flex-col z-[50] transition-transform duration-300 lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 hidden lg:flex items-center gap-3 shrink-0">
          <div className="bg-red-600 p-2 rounded-lg">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            BD <span className="text-red-600 uppercase">Tracker</span>
          </h1>
        </div>

        <div className="p-8 lg:hidden flex items-center justify-between shrink-0 border-b border-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-2 rounded-lg">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <h1 className="text-lg font-black tracking-tight text-slate-900">BD Tracker</h1>
          </div>
          <button onClick={closeMobileMenu} className="p-2 text-slate-400">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Main Menu
          </div>
          <SidebarLink to="/" icon={LayoutDashboard} label="Dashboard" onClick={closeMobileMenu} />
          <SidebarLink to="/leads" icon={Users} label="Lead Management" onClick={closeMobileMenu} />
          <SidebarLink to="/onboarding" icon={UserCheck} label="Vendor Onboarding" onClick={closeMobileMenu} />
          {(user?.role === 'super_admin' || user?.role === 'admin') && (
            <SidebarLink to="/users" icon={Settings} label="Team Management" onClick={closeMobileMenu} />
          )}
          {user?.role === 'super_admin' && (
            <>
              <SidebarLink to="/daily-report" icon={PieChart} label="Daily Call Report" onClick={closeMobileMenu} />
              <SidebarLink to="/nepalcan-sales" icon={ShoppingBag} label="Nepalcan Sales" onClick={closeMobileMenu} />
            </>
          )}
          <SidebarLink to="/goals" icon={Target} label="Monthly Goals" onClick={closeMobileMenu} />
          <SidebarLink to="/tasks" icon={ClipboardList} label="Tasks" onClick={closeMobileMenu} />
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <SidebarLink to="/tickets" icon={MessageSquare} label="Tickets" onClick={closeMobileMenu} />
          )}
          <SidebarLink to="/analytics" icon={BarChart3} label="Analytics" onClick={closeMobileMenu} />
        </nav>

        <div className="p-4 mt-auto border-t border-slate-50">
          <div className="bg-slate-50 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg shadow-red-100">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
                <p className="text-xs font-medium text-slate-500 truncate uppercase">{user?.role}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-red-600 hover:bg-red-100 rounded-xl transition-all font-bold text-xs"
            >
              <LogOut size={16} />
              <span>Logout Session</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="hidden lg:flex h-20 items-center justify-end px-10 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-[30]">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <ShieldCheck size={14} className="text-red-600" />
              <span>Secure Session Active</span>
            </div>
            <div className="w-px h-6 bg-slate-100" />
            <NotificationBell token={token} />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pt-16 lg:pt-0">
          <div className="p-4 lg:p-10">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
