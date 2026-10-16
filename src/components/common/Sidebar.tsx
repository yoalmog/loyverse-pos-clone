import React from 'react';
import { usePOS, AppRoute } from '../../context/POSContext.tsx';
import {
  CreditCard,
  Receipt,
  Package,
  FolderTree,
  Layers,
  Users,
  UserCheck,
  BarChart3,
  Tag,
  Settings,
  Lock,
  Wifi,
  WifiOff,
  RefreshCw,
  Store,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2
} from 'lucide-react';

interface NavItem {
  id: AppRoute;
  labelKey: string;
  defaultLabel: string;
  icon: React.ElementType;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'pos', labelKey: 'nav.pos', defaultLabel: 'Point of Sale', icon: CreditCard },
  { id: 'sales', labelKey: 'nav.sales', defaultLabel: 'Sales History', icon: Receipt },
  { id: 'products', labelKey: 'nav.products', defaultLabel: 'Products', icon: Package },
  { id: 'categories', labelKey: 'nav.categories', defaultLabel: 'Categories', icon: FolderTree },
  { id: 'menu-scanner', labelKey: 'nav.menuScanner', defaultLabel: 'AI Menu Scanner', icon: Sparkles, badge: 'AI' },
  { id: 'inventory', labelKey: 'nav.inventory', defaultLabel: 'Inventory', icon: Layers },
  { id: 'customers', labelKey: 'nav.customers', defaultLabel: 'Customers', icon: Users },
  { id: 'employees', labelKey: 'nav.employees', defaultLabel: 'Employees', icon: UserCheck },
  { id: 'reports', labelKey: 'nav.reports', defaultLabel: 'Reports', icon: BarChart3 },
  { id: 'discounts', labelKey: 'nav.discounts', defaultLabel: 'Discounts', icon: Tag },
  { id: 'settings', labelKey: 'nav.settings', defaultLabel: 'Settings', icon: Settings },
  { id: 'backoffice', labelKey: 'nav.backOffice', defaultLabel: 'Back Office HQ', icon: Building2, badge: 'HQ' },
];

export const Sidebar: React.FC = () => {
  const {
    activeRoute,
    setActiveRoute,
    currentEmployee,
    setIsPinLocked,
    settings,
    isOffline,
    isSyncing,
    pendingSyncCount,
    triggerSync,
    isSidebarCollapsed,
    toggleSidebar,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    t
  } = usePOS();

  const handleNavClick = (route: AppRoute) => {
    setActiveRoute(route);
    setIsMobileSidebarOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:static flex flex-col shrink-0 bg-slate-900 text-slate-300 border-r border-slate-800 select-none h-screen transition-all duration-300 ease-in-out ${
          // Mobile responsive slide-over drawer
          isMobileSidebarOpen
            ? 'translate-x-0 w-72 max-w-[85vw] shadow-2xl'
            : '-translate-x-full lg:translate-x-0'
        } ${
          // Desktop collapse state
          isSidebarCollapsed ? 'lg:w-18' : 'lg:w-60'
        }`}
      >
        {/* Brand Header & Collapse Toggle */}
        <div
          className={`h-16 flex items-center border-b border-slate-800 px-3 ${
            isSidebarCollapsed ? 'lg:justify-center' : 'justify-between'
          }`}
        >
          {/* Logo & Store Name */}
          <div className={`flex items-center gap-3 min-w-0 ${isSidebarCollapsed ? 'lg:hidden' : 'flex'}`}>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold shadow-md shrink-0 overflow-hidden"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.name}
                  className="w-full h-full object-cover"
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Store className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white tracking-tight truncate">{settings.name}</h1>
              <p className="text-[11px] text-slate-400 truncate">Register #1 · SF Main</p>
            </div>
          </div>

          {/* Collapsed state logo on desktop */}
          {isSidebarCollapsed && (
            <div
              className="hidden lg:flex w-9 h-9 rounded-xl items-center justify-center text-white font-bold shadow-md shrink-0 overflow-hidden"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.name}
                  className="w-full h-full object-cover"
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Store className="w-5 h-5" />
              )}
            </div>
          )}

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={toggleSidebar}
            className={`hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
              isSidebarCollapsed ? 'mt-1' : ''
            }`}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 text-blue-400" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden ml-auto"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;
            const label = t(item.labelKey, item.defaultLabel);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                title={isSidebarCollapsed ? label : undefined}
                className={`w-full flex items-center rounded-xl text-xs font-medium transition-all text-left group ${
                  isSidebarCollapsed
                    ? 'lg:justify-center p-2.5'
                    : 'gap-3 px-3.5 py-2.5'
                } ${
                  isActive
                    ? 'text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/70'
                }`}
                style={isActive ? { backgroundColor: 'var(--theme-primary)' } : undefined}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:scale-110'
                  }`}
                />
                <span className={`truncate flex-1 ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>
                  {label}
                </span>
                {item.badge && !isSidebarCollapsed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/30 text-blue-300 font-bold border border-blue-400/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Offline & Sync Section */}
        <div className={`px-2.5 py-2 border-t border-slate-800 ${isSidebarCollapsed ? 'lg:px-2' : ''}`}>
          <div
            className={`bg-slate-800/80 rounded-xl p-2 flex items-center ${
              isSidebarCollapsed ? 'lg:justify-center' : 'justify-between'
            }`}
          >
            <div
              className={`flex items-center gap-2 text-left ${
                isSidebarCollapsed ? 'lg:justify-center' : ''
              }`}
              title={
                isOffline ? 'Network Offline' : 'Network Online'
              }
            >
              {isOffline ? (
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <div className={isSidebarCollapsed ? 'lg:hidden' : 'block'}>
                <p className="text-[11px] font-semibold text-slate-200">
                  {isOffline ? t('header.offline', 'Offline Mode') : t('header.online', 'Online')}
                </p>
                <p className="text-[10px] text-slate-400">
                  {pendingSyncCount > 0 ? `${pendingSyncCount} queued` : 'Sync up to date'}
                </p>
              </div>
            </div>

            {pendingSyncCount > 0 && !isSidebarCollapsed && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="p-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white transition-colors"
                title="Sync pending transactions"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Cashier & Lock Bottom Bar */}
        <div className="p-2.5 border-t border-slate-800 bg-slate-950/60">
          <div
            className={`flex items-center gap-2 ${
              isSidebarCollapsed ? 'lg:flex-col lg:justify-center' : 'justify-between'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0"
                title={isSidebarCollapsed ? currentEmployee.name : undefined}
              >
                {currentEmployee.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className={`truncate ${isSidebarCollapsed ? 'lg:hidden' : 'block'}`}>
                <p className="text-xs font-medium text-slate-200 truncate leading-tight">
                  {currentEmployee.name}
                </p>
                <p className="text-[10px] text-slate-400 capitalize">{currentEmployee.role}</p>
              </div>
            </div>

            <button
              onClick={() => {
                setIsPinLocked(true);
                setIsMobileSidebarOpen(false);
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Lock Register (PIN Required)"
              aria-label="Lock Register"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
