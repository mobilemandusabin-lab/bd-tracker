import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import {
  LayoutDashboard, Users, UserCheck, ClipboardList, BarChart3, LogOut,
  ShieldCheck, Settings, Menu, X, Target, MessageSquare,
  ShoppingBag, Cog, Store, Package, ChevronRight, Puzzle, Activity, Award
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
        "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
        isActive
          ? "bg-red-50 text-red-700"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
      )}
    >
      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-red-600 rounded-r-full" />}
      <Icon size={18} className={cn(isActive ? "text-red-600" : "text-slate-400 group-hover:text-slate-600")} />
      <span className="font-semibold text-sm">{label}</span>
      {isActive && <ChevronRight size={14} className="ml-auto text-red-400" />}
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

  const hasPermission = (perm) => {
    if (user?.role === 'super_admin') return true;
    return user?.permissions?.includes(perm) || false;
  };

  const navSections = [
    {
      label: 'Overview',
      items: [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      ]
    },
    {
      label: 'Sales Pipeline',
      items: [
        { to: '/leads', icon: Users, label: 'Leads' },
        ...(hasPermission('vendors.view')
          ? [{ to: '/vendors', icon: Store, label: 'Vendors' }]
          : []),
        ...(hasPermission('leads.view')
          ? [{ to: '/active-sellers', icon: Package, label: 'Active Sellers' }]
          : []),
      ]
    },
    {
      label: 'Performance',
      items: [
        { to: '/goals', icon: Target, label: 'Goals' },
        { to: '/bd-tiers', icon: Award, label: 'BD Tiers' },
        { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
        ...(hasPermission('tickets.view')
          ? [{ to: '/tickets', icon: MessageSquare, label: 'Tickets' }]
          : []),
      ]
    },
    {
      label: 'Management',
      items: [
        ...(hasPermission('users.view')
          ? [{ to: '/users', icon: Settings, label: 'Team' }]
          : []),
        ...(hasPermission('nepalcan.view')
          ? [{ to: '/nepalcan-sales', icon: ShoppingBag, label: 'Nepalcan Sales' }]
          : []),
        ...(hasPermission('pipeline.manage')
          ? [{ to: '/settings', icon: Cog, label: 'Settings' }]
          : []),
      ]
    },
    {
      label: 'Internal Operations',
      items: [
        ...(hasPermission('extension.admin')
          ? [{ to: '/operations-analytics', icon: Activity, label: 'Operations Analytics' }]
          : []),
        ...(hasPermission('extension.view')
          ? [{ to: '/extension', icon: Puzzle, label: 'Chrome Extension' }]
          : []),
      ]
    },
  ];

  return (
    <div className="flex h-screen bg-[#fafafa] overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-100 z-[300] flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="bg-red-600 p-1.5 rounded-lg">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <h1 className="text-base font-extrabold tracking-tight text-slate-900">
            BD <span className="text-red-600">Tracker</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell token={token} />
          <button
            onClick={toggleMobileMenu}
            className="p-2 text-slate-500 hover:bg-slate-50 rounded-xl transition-all"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[45]"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-100 flex flex-col z-[50] transition-transform duration-300 ease-out lg:translate-x-0",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="p-6 flex items-center gap-3 shrink-0">
          <div className="bg-red-600 p-2 rounded-xl shadow-lg shadow-red-200">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              BD <span className="text-red-600">Tracker</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CRM Platform</p>
          </div>
          <button onClick={closeMobileMenu} className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-5 overflow-y-auto">
          {navSections.map((section) => (
            section.items.length > 0 && (
              <div key={section.label}>
                <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <SidebarLink
                      key={item.to}
                      to={item.to}
                      icon={item.icon}
                      label={item.label}
                      onClick={closeMobileMenu}
                    />
                  ))}
                </div>
              </div>
            )
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-3 mt-auto border-t border-slate-50">
          <div className="p-3 rounded-xl bg-slate-50/80">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-red-200">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{user?.name}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all font-bold text-xs"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Desktop Header */}
        <header className="hidden lg:flex h-14 items-center justify-between px-8 border-b border-slate-100 bg-white/80 backdrop-blur-md shrink-0 relative z-[300]">
          <div />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span>Secure Session</span>
            </div>
            <div className="w-px h-5 bg-slate-100" />
            <NotificationBell token={token} />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto pt-14 lg:pt-0">
          <div className="p-4 lg:p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
