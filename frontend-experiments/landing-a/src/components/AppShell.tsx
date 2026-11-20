import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Button, Input, Layout, Menu, type MenuProps } from "antd";
import {
  DatabaseOutlined,
  ExperimentOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  ProjectOutlined,
  SearchOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
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

// Same structure as DashboardComponent: nz-sider (light, collapsible to 45px) with an
// inline nz-menu, then a 70px nav bar with the search box and Sign in. antd's Sider and
// Menu are the React counterparts of ng-zorro's, so this is close to a straight port.

const ICONS: Record<HubIcon, ReactNode> = {
  home: <HomeOutlined />,
  project: <ProjectOutlined />,
  database: <DatabaseOutlined />,
  model: <ExperimentOutlined />,
};

const tabPath = (t: HubTab) => (t.type ? paths.hubResults(t.type) : paths.home);

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: settings } = useQuery(shellQueries.publicSettings());
  const shell = shellLayout(settings);
  const user = getCurrentUser();

  const items: MenuProps["items"] = [
    ...(shell.hubEnabled
      ? [
          {
            key: "hub",
            icon: <UsergroupAddOutlined />,
            label: "Hub",
            children: shell.hubTabs.map(t => ({
              key: tabPath(t),
              icon: ICONS[t.icon],
              title: t.tooltip,
              label: <Link to={tabPath(t)}>{t.label}</Link>,
            })),
          },
        ]
      : []),
    ...(shell.aboutEnabled
      ? [{ key: paths.about, icon: <InfoCircleOutlined />, label: <Link to={paths.about}>About</Link> }]
      : []),
  ];
  // nzMatchRouter: highlight the item whose route is active.
  const selected = [paths.home, paths.about, ...shell.hubTabs.map(tabPath)].filter(p =>
    p === paths.home ? pathname === p : pathname.startsWith(p)
  );

  return (
    <Layout className="h-screen">
      <Layout.Sider
        theme="light"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={SIDER_WIDTH}
        collapsedWidth={SIDER_COLLAPSED_WIDTH}>
        <div className="flex items-center justify-center" style={{ height: NAV_HEIGHT }}>
          {collapsed ? (
            <img alt="mini-logo" src={shell.miniLogo} className="h-8 w-8 object-contain" />
          ) : (
            <img alt="logo" src={shell.logo} className="h-[50px]" />
          )}
        </div>
        <Menu
          mode="inline"
          items={items}
          selectedKeys={selected}
          defaultOpenKeys={["hub"]}
          className="overflow-x-hidden overflow-y-auto !border-none"
          style={{ height: `calc(100vh - ${NAV_HEIGHT}px - 48px)` }}
        />
        <span className="pointer-events-none absolute bottom-[5px] left-[5px] z-[5] text-[0.4em] text-gray-500">
          {BUILD_LABEL} · variant A
        </span>
      </Layout.Sider>

      <Layout className="min-w-0 border-l border-[#f0f0f0]">
        <div className="flex items-center justify-between bg-white px-[15px] py-2.5" style={{ height: NAV_HEIGHT }}>
          <Input
            size="large"
            placeholder="Search"
            prefix={<SearchOutlined className="text-[#888]" />}
            className="mr-2.5 flex-1"
            onPressEnter={e => {
              const q = e.currentTarget.value.trim();
              navigate(q ? `${paths.search}?q=${encodeURIComponent(q)}` : paths.search);
            }}
          />
          {user ? (
            <Avatar className="!mx-6 !bg-gray-500">{abbreviate(user.name)}</Avatar>
          ) : (
            <Link to={paths.login}>
              <Button type="primary" size="large" className="!mx-2 !rounded !px-9">
                Sign in
              </Button>
            </Link>
          )}
        </div>
        <Layout.Content className="relative min-h-0 flex-1 overflow-y-auto !bg-white">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
