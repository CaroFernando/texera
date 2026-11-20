import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, Database, FlaskConical, FolderKanban, House, Info, Search, UserPlus } from "lucide-react";
import { Link, Outlet, useMatch, useNavigate } from "react-router";
import {
  BUILD_LABEL,
  NAV_HEIGHT,
  SIDER_COLLAPSED_WIDTH,
  SIDER_WIDTH,
  abbreviate,
  getCurrentUser,
  paths,
  shellLayout,
  shellQueries,
  type HubIcon,
  type HubTab,
} from "@exp/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";

// Mirrors DashboardComponent with shadcn's Sidebar (collapsible="icon"), sized like
// the nz-sider (200px / 45px). Icons are lucide equivalents of the antd ones.

const ICONS: Record<HubIcon, typeof House> = { home: House, project: FolderKanban, database: Database, model: FlaskConical };
const ITEM = "h-10 hover:bg-transparent hover:text-primary";
const tabPath = (t: HubTab) => (t.type ? paths.hubResults(t.type) : paths.home);

function NavItem({ to, label, tooltip, icon: Icon, end, indent }: { to: string; label: string; tooltip: string; icon: typeof House; end?: boolean; indent?: boolean }) {
  const active = useMatch({ path: to, end: !!end }) !== null;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={tooltip} className={`${ITEM} ${indent ? "pl-12" : "pl-6"}`}>
        <Link to={to}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function Logo({ logo, miniLogo }: { logo: string; miniLogo: string }) {
  const { state } = useSidebar();
  return state === "collapsed" ? (
    <img alt="mini-logo" src={miniLogo} className="h-8 w-8 object-contain" />
  ) : (
    <img alt="logo" src={logo} className="h-[50px]" />
  );
}

/** The bottom bar ng-zorro's nzCollapsible adds. */
function CollapseTrigger() {
  const { state, toggleSidebar } = useSidebar();
  return (
    <button onClick={toggleSidebar} aria-label="Toggle sidebar" className="flex h-12 w-full items-center justify-center border-t border-sidebar-border text-muted-foreground hover:text-primary">
      {state === "collapsed" ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
    </button>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const { data: settings } = useQuery(shellQueries.publicSettings());
  const shell = shellLayout(settings);
  const user = getCurrentUser();

  return (
    <SidebarProvider
      className="h-screen min-h-0"
      style={{ "--sidebar-width": `${SIDER_WIDTH}px`, "--sidebar-width-icon": `${SIDER_COLLAPSED_WIDTH}px` } as CSSProperties}>
      <Sidebar collapsible="icon" className="border-r-0">
        <SidebarHeader className="items-center justify-center p-0" style={{ height: NAV_HEIGHT }}>
          <Logo logo={shell.logo} miniLogo={shell.miniLogo} />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu className="gap-0">
            {shell.hubEnabled && (
              <Collapsible defaultOpen asChild className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Hub" className={`${ITEM} pl-6`}>
                      <UserPlus />
                      <span>Hub</span>
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {/* hidden when collapsed to icons; the antd menu shows them in a flyout instead */}
                    <SidebarMenu className="gap-0 group-data-[collapsible=icon]:hidden">
                      {shell.hubTabs.map(t => (
                        <NavItem key={t.key} to={tabPath(t)} label={t.label} tooltip={t.tooltip} icon={ICONS[t.icon]} end={!t.type} indent />
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            )}
            {shell.aboutEnabled && <NavItem to={paths.about} label="About" tooltip="About" icon={Info} end />}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="relative p-0">
          <span className="pointer-events-none absolute bottom-[53px] left-[5px] text-[0.4em] text-gray-500">
            {BUILD_LABEL} · variant B
          </span>
          <CollapseTrigger />
        </SidebarFooter>
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col border-l border-[#f0f0f0]">
        <div className="flex items-center justify-between bg-white px-[15px] py-2.5" style={{ height: NAV_HEIGHT }}>
          <form
            className="relative mr-2.5 flex-1"
            onSubmit={e => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q")?.toString().trim() ?? "";
              navigate(q ? `${paths.search}?q=${encodeURIComponent(q)}` : paths.search);
            }}>
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#888]" />
            <Input name="q" placeholder="Search" className="h-10 rounded pl-9 text-base md:text-base" />
          </form>
          {user ? (
            <Avatar className="mx-6">
              <AvatarFallback className="bg-gray-500 text-white">{abbreviate(user.name)}</AvatarFallback>
            </Avatar>
          ) : (
            <Button asChild className="mx-2 h-10 rounded px-9 text-base">
              <Link to={paths.login}>Sign in</Link>
            </Button>
          )}
        </div>
        <main className="relative min-h-0 flex-1 overflow-y-auto bg-white">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
