import { Link, useLocation } from "wouter";
import { Building2, LayoutDashboard, CheckSquare, Users, LogOut, Bell, Menu, Activity } from "lucide-react";
import { useAuth, useLogout } from "@/hooks/use-auth";
import { useNotifications, useNotificationsSSE, useMarkNotificationRead, useMarkAllNotificationsRead } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: user } = useAuth();
  const logout = useLogout();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Start SSE for real-time notifications
  useNotificationsSSE();

  const navItems = {
    CUSTOMER: [
      { label: "My Companies", href: "/dashboard", icon: Building2 },
    ],
    FACILITATOR: [
      { label: "Assigned Pipelines", href: "/facilitator", icon: CheckSquare },
    ],
    ADMIN: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Companies", href: "/admin/companies", icon: Building2 },
      { label: "Users", href: "/admin/users", icon: Users },
    ],
  };

  const links = user ? navItems[user.role] || [] : [];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-sm">
          B
        </div>
        <span className="font-display font-bold tracking-tight text-xl text-slate-900 dark:text-white">BizSetup</span>
      </div>
      
      <div className="px-4 py-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Menu</p>
        <nav className="space-y-1">
          {links.map((link) => {
            const isActive = location === link.href || location.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link 
                key={link.href} 
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="mt-auto p-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 px-2 py-3">
          <Avatar className="h-9 w-9 border border-slate-200">
            <AvatarImage src={user?.avatarUrl || ""} />
            <AvatarFallback className="bg-primary/5 text-primary text-xs font-semibold">
              {user ? getInitials(user.name) : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.role}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-slate-600 hover:text-red-600 hover:bg-red-50 mt-1" 
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 shadow-sm z-10">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 shrink-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 z-10">
          <div className="flex items-center gap-4">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <SidebarContent />
              </SheetContent>
            </Sheet>
            
            <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-slate-500">
              <Activity className="w-4 h-4 text-primary" />
              <span>{user?.role === 'CUSTOMER' ? 'Customer Portal' : user?.role === 'ADMIN' ? 'Admin Dashboard' : 'Facilitator Portal'}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function NotificationBell() {
  const { data: user } = useAuth();
  const { data: { data: notifications = [], unreadCount = 0 } = {} } = useNotifications(false);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [, navigate] = useLocation();

  function getPipelineHref(pipelineId: string) {
    if (!user) return null;
    if (user.role === "CUSTOMER") return `/dashboard/company/${pipelineId}`;
    if (user.role === "FACILITATOR") return `/facilitator/pipeline/${pipelineId}`;
    return `/facilitator/pipeline/${pipelineId}`;
  }

  function handleNotifClick(notif: typeof notifications[number], closeDropdown?: () => void) {
    if (!notif.read) markRead.mutate(notif.id);
    if (notif.pipelineId) {
      const href = getPipelineHref(notif.pipelineId);
      if (href) {
        navigate(href);
        closeDropdown?.();
      }
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 rounded-full w-10 h-10">
          <Bell className="w-5 h-5 text-slate-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white px-0.5">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 shadow-xl rounded-xl border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center text-xs font-semibold bg-primary/10 text-primary rounded-full px-2 py-0.5">
                {unreadCount} unread
              </span>
            )}
          </h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-primary h-auto py-1 px-2"
              onClick={(e) => {
                e.preventDefault();
                markAllRead.mutate();
              }}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto py-2">
          {notifications.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              <Bell className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              No notifications yet
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`px-4 py-3 transition-colors ${notif.pipelineId ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default hover:bg-slate-50'} ${!notif.read ? 'bg-primary/5' : ''}`}
                onClick={() => handleNotifClick(notif)}
              >
                <div className="flex justify-between items-start gap-2">
                  <p className={`text-sm leading-snug ${!notif.read ? 'text-slate-900 font-medium' : 'text-slate-600'}`}>
                    {notif.message}
                  </p>
                  {!notif.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                </p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
