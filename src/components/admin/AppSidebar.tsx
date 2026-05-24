import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Users,
  CalendarCheck2,
  CreditCard,
  LifeBuoy,
  BarChart3,
  ShieldCheck,
  Shield,
  RotateCcw,
  Bot,
  FileCheck,
  BookOpen,
} from "lucide-react";

const items = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "SAIL", url: "/admin/sail", icon: Bot },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Verifications", url: "/admin/verifications", icon: FileCheck },
  { title: "Curriculum Templates", url: "/admin/curriculum-templates", icon: BookOpen },
  { title: "Library", url: "/admin/library", icon: BookOpen },
  { title: "Allocations", url: "/admin/allocations", icon: CalendarCheck2 },
  { title: "Bookings", url: "/admin/bookings", icon: CalendarCheck2 },
  { title: "Payments", url: "/admin/payments", icon: CreditCard },
  { title: "Support", url: "/admin/support", icon: LifeBuoy },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "Roles", url: "/admin/roles", icon: ShieldCheck },
  { title: "Security", url: "/admin/security", icon: Shield },
  { title: "Refunds", url: "/admin/refunds", icon: RotateCcw },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default AppSidebar;
