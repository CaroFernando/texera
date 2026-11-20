import { For, Show, createSignal, type Component, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Collapsible } from "@kobalte/core/collapsible";
import { useQuery } from "@tanstack/solid-query";
import { Link, Outlet, useNavigate, type LinkProps } from "@tanstack/solid-router";
import { ChevronDown, ChevronLeft, ChevronRight, Database, FlaskConical, FolderKanban, House, Info, Search, UserPlus } from "lucide-solid";
import {
  BUILD_LABEL,
  NAV_HEIGHT,
  SIDER_COLLAPSED_WIDTH,
  SIDER_WIDTH,
  abbreviate,
  getCurrentUser,
  shellLayout,
  shellQueries,
  type HubIcon,
  type HubTab,
} from "@exp/shared";
import { Avatar, Input, buttonVariants } from "@/components/ui";

// Same shell as B/C (DashboardComponent layout: 200px / 45px light sider, 70px nav bar),
// built by hand: there is no shadcn Sidebar for Solid here, so it is an <aside> with a
// collapsed signal, Kobalte's Collapsible for the Hub submenu and the same classes.

type Icon = Component<{ class?: string }>;
const ICONS: Record<HubIcon, Icon> = { home: House, project: FolderKanban, database: Database, model: FlaskConical };
const ITEM =
  "flex h-10 w-full items-center gap-2 overflow-hidden rounded-md text-left text-sm text-sidebar-foreground outline-hidden transition-[padding] hover:text-primary focus-visible:ring-2 focus-visible:ring-ring";
const ACTIVE = "bg-sidebar-accent font-medium text-sidebar-accent-foreground";

const tabLink = (t: HubTab): LinkProps =>
  t.type ? { to: "/hub/$type/result", params: { type: t.type } } : { to: "/" };

export function AppShell() {
  const [collapsed, setCollapsed] = createSignal(false);
  const navigate = useNavigate();
  const settings = useQuery(() => shellQueries.publicSettings());
  const shell = () => shellLayout(settings.data);
  const user = getCurrentUser();
  // Collapsed: icons only, centered, label as a native tooltip (shadcn shows a Tooltip there).
  const pad = (indent?: boolean) => (collapsed() ? "justify-center px-0" : indent ? "pl-12" : "pl-6");

  const NavItem = (props: { link: LinkProps; label: string; tooltip: string; icon: Icon; exact?: boolean; indent?: boolean }) => (
    <li>
      <Link
        {...props.link}
        class={`${ITEM} ${pad(props.indent)}`}
        activeOptions={{ exact: !!props.exact }}
        activeProps={{ class: ACTIVE }}
        title={collapsed() ? props.tooltip : undefined}>
        <Dynamic component={props.icon} class="size-4 shrink-0" />
        <Show when={!collapsed()}>
          <span class="truncate">{props.label}</span>
        </Show>
      </Link>
    </li>
  );

  const onSearch: JSX.EventHandler<HTMLFormElement, SubmitEvent> = e => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim() ?? "";
    void navigate({ to: "/search", search: { q: q || undefined } });
  };

  return (
    <div class="flex h-screen">
      <aside
        class="relative flex shrink-0 flex-col bg-sidebar transition-[width] duration-200"
        style={{ width: `${collapsed() ? SIDER_COLLAPSED_WIDTH : SIDER_WIDTH}px` }}>
        <div class="flex items-center justify-center" style={{ height: `${NAV_HEIGHT}px` }}>
          <Show when={collapsed()} fallback={<img alt="logo" src={shell().logo} class="h-[50px]" />}>
            <img alt="mini-logo" src={shell().miniLogo} class="h-8 w-8 object-contain" />
          </Show>
        </div>
        <nav class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-2">
          <ul>
            <Show when={shell().hubEnabled}>
              <Collapsible as="li" defaultOpen class="group/collapsible">
                <Collapsible.Trigger class={`${ITEM} ${pad()}`} title={collapsed() ? "Hub" : undefined}>
                  <UserPlus class="size-4 shrink-0" />
                  <Show when={!collapsed()}>
                    <span>Hub</span>
                    <ChevronDown class="ml-auto size-4 transition-transform group-data-[expanded]/collapsible:rotate-180" />
                  </Show>
                </Collapsible.Trigger>
                {/* hidden when collapsed to icons; the antd menu shows them in a flyout instead */}
                <Show when={!collapsed()}>
                  <Collapsible.Content as="ul">
                    <For each={shell().hubTabs}>
                      {t => (
                        <NavItem link={tabLink(t)} label={t.label} tooltip={t.tooltip} icon={ICONS[t.icon]} exact={!t.type} indent />
                      )}
                    </For>
                  </Collapsible.Content>
                </Show>
              </Collapsible>
            </Show>
            <Show when={shell().aboutEnabled}>
              <NavItem link={{ to: "/about" }} label="About" tooltip="About" icon={Info} exact />
            </Show>
          </ul>
        </nav>
        <span class="pointer-events-none absolute bottom-[53px] left-[5px] text-[0.4em] text-gray-500">
          {BUILD_LABEL} · variant D
        </span>
        {/* the bottom bar ng-zorro's nzCollapsible adds */}
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label="Toggle sidebar"
          class="flex h-12 w-full items-center justify-center border-t border-sidebar-border text-muted-foreground hover:text-primary">
          <Show when={collapsed()} fallback={<ChevronLeft class="size-4" />}>
            <ChevronRight class="size-4" />
          </Show>
        </button>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col border-l border-[#f0f0f0]">
        <div class="flex items-center justify-between bg-white px-[15px] py-2.5" style={{ height: `${NAV_HEIGHT}px` }}>
          <form class="relative mr-2.5 flex-1" onSubmit={onSearch}>
            <Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#888]" />
            <Input name="q" placeholder="Search" class="h-10 rounded pl-9 text-base md:text-base" />
          </form>
          <Show
            when={user}
            fallback={
              <Link to="/login" class={`${buttonVariants()} mx-2 h-10 rounded px-9 text-base`}>
                Sign in
              </Link>
            }>
            <Avatar class="mx-6" fallbackClass="bg-gray-500 text-white">
              {abbreviate(user?.name)}
            </Avatar>
          </Show>
        </div>
        <main class="relative min-h-0 flex-1 overflow-y-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
