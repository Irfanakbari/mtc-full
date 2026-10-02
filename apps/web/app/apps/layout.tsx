"use client";

import {
  ApiOutlined,
  BarChartOutlined,
  BellOutlined,
  DatabaseOutlined,
  HistoryOutlined,
  InfoCircleOutlined,
  LockOutlined,
  LogoutOutlined,
  ReconciliationOutlined,
  SettingOutlined,
  SwapOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useVuteqSso } from "@vuteq/sso-client-react/react";
import {
  App,
  Avatar,
  Badge,
  Button,
  Dropdown,
  Layout,
  Menu,
  Spin,
  Tooltip,
  type MenuProps,
} from "antd";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import CreditInformationModal from "./_components/CreditInformationModal";
import PrivacyPolicyModal from "./_components/PrivacyPolicyModal";
import UpdateLogModal from "./_components/UpdateLogModal";
import "../batik.css";

const { Header, Sider, Content, Footer } = Layout;
const APP_VERSION = "1.0.0";

type Entry = {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  permission?: string;
  children?: Entry[];
};

const item = (
  label: React.ReactNode,
  key: string,
  icon?: React.ReactNode,
  permission?: string,
  children?: Entry[],
): Entry => ({ label, key, icon, permission, children });

const menu: Entry[] = [
  item(<Link href="/apps">Dashboard</Link>, "/apps", <BarChartOutlined />, "MTC.DASHBOARD.READ"),
  item("Master Data", "master", <DatabaseOutlined />, undefined, [
    item(<Link href="/apps/master-data/items">Inventory Items</Link>, "/apps/master-data/items", undefined, "MTC.ITEM.READ"),
  ]),
  item("Warehouse", "warehouse", <SwapOutlined />, undefined, [
    item(<Link href="/apps/warehouse/stock-transactions">Stock Transactions</Link>, "/apps/warehouse/stock-transactions", undefined, "MTC.STOCK.READ"),
    item(<Link href="/apps/warehouse/inventory-counting">Inventory Counting</Link>, "/apps/warehouse/inventory-counting", undefined, "MTC.OPNAME.READ"),
  ]),
  item("System Administration", "admin", <SettingOutlined />, undefined, [
    item(<Link href="/apps/system-administration/stock-ledger">Stock Ledger</Link>, "/apps/system-administration/stock-ledger", <HistoryOutlined />, "MTC.STOCK.READ"),
    item(<Link href="/apps/system-administration/user-accounts">User Accounts</Link>, "/apps/system-administration/user-accounts", <UserOutlined />, "MTC.USER_MANAGEMENT"),
    item(<Link href="/apps/system-administration/roles-configuration">Roles Configuration</Link>, "/apps/system-administration/roles-configuration", undefined, "MTC.ROLE_MANAGEMENT"),
    item(<Link href="/apps/system-administration/permissions-setup">Permissions Setup</Link>, "/apps/system-administration/permissions-setup", undefined, "MTC.ROLE_MANAGEMENT"),
    item(<Link href="/apps/system-administration/api-key-management">API Key Management</Link>, "/apps/system-administration/api-key-management", <ApiOutlined />, "MTC.API_KEY_MANAGEMENT"),
    item(<Link href="/apps/system-administration/system-log">System Logs</Link>, "/apps/system-administration/system-log", <ReconciliationOutlined />, "MTC.SYSTEM_LOG_READ"),
  ]),
];

function menuWithPermissions(
  entries: Entry[],
  permissions: string[],
  superUser: boolean,
): Entry[] {
  return entries.map((entry) => {
    const children = entry.children
      ? menuWithPermissions(entry.children, permissions, superUser)
      : undefined;
    const hasActiveChild = children?.some((child) => !Reflect.get(child, "disabled")) ?? false;
    const allowed = superUser || !entry.permission || permissions.includes(entry.permission);
    const enabled = children ? allowed && hasActiveChild : allowed;

    return {
      ...entry,
      children,
      disabled: !enabled,
      label: enabled ? entry.label : (
        <span className="flex w-full items-center justify-between opacity-60">
          <span>{entry.label}</span>
          <LockOutlined style={{ color: "#94A3B8", fontSize: 12, marginLeft: 6 }} />
        </span>
      ),
    } as Entry;
  });
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) return <strong className="mtc-logo-collapsed">M</strong>;
  return (
    <div className="mtc-logo-lockup" aria-label="MTC Inventory System">
      <Image src="/images/vtqw.png" alt="Vuteq" width={135} height={47} priority />
      <span>MTC</span>
    </div>
  );
}

export default function AppsLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [informationOpen, setInformationOpen] = useState(false);
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);
  const [updateLogOpen, setUpdateLogOpen] = useState(false);
  const { session, loading } = useVuteqSso();
  const pathname = usePathname();
  const { modal } = App.useApp();

  useEffect(() => {
    if (!loading && !session) window.location.replace("/auth/login");
  }, [loading, session]);

  const permissions = useMemo(() => session?.permissions ?? [], [session?.permissions]);
  const superUser = Boolean(
    session?.globalRoles?.includes("SUPER_ADMINISTRATOR") ||
      session?.roles?.includes("SUPER") ||
      permissions.includes("SUPER") ||
      permissions.includes("*"),
  );
  const items = useMemo(
    () => menuWithPermissions(menu, permissions, superUser),
    [permissions, superUser],
  );

  const logout = () =>
    modal.confirm({
      centered: true,
      title: "Sign out?",
      content: "This will end your MTC and central Vuteq SSO session.",
      okText: "Sign out",
      okButtonProps: { danger: true },
      onOk: () => {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = "/auth/logout";
        document.body.appendChild(form);
        form.submit();
      },
    });

  if (loading || !session) {
    return (
      <div className="mtc-session-loader">
        <Brand />
        <Spin size="large" />
        <div>Checking your Vuteq account session...</div>
      </div>
    );
  }

  const displayName = session.user.name ?? session.user.preferred_username ?? "User";
  const userMenu: MenuProps["items"] = [
    { key: "identity", label: displayName, disabled: true, icon: <UserOutlined /> },
    { type: "divider" },
    { key: "logout", label: "Sign out", icon: <LogoutOutlined />, onClick: logout },
  ];

  return (
    <>
      <Layout style={{ minHeight: "100vh", display: "flex" }}>
        <Sider
          className="mtc-sider"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={300}
          theme="dark"
          style={{
            overflow: "auto",
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            background: "#263545",
          }}
        >
          <div className="flex h-[104px] items-center justify-center p-1 text-center">
            <Brand collapsed={collapsed} />
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[pathname]}
            items={items as MenuProps["items"]}
            style={{ background: "transparent", padding: "4px 8px" }}
          />
        </Sider>

        <Layout
          style={{
            marginLeft: collapsed ? 80 : 300,
            transition: "margin-left 0.2s",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
          }}
        >
          <Header
            className="batik-bg mtc-header-footer"
            style={{
              padding: "0 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              top: 0,
              zIndex: 1000,
              width: "100%",
              flexShrink: 0,
            }}
          >
            <h2 className="mtc-header-title">MTC Inventory System</h2>
            <div className="flex h-8 items-center gap-2">
              <span className="mr-2 leading-8 text-white">Hello, {displayName}</span>
              <Dropdown
                menu={{ items: [{ key: "empty", label: "No notifications", disabled: true }] }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <span className="mtc-header-icon" aria-label="Notifications">
                  <Badge count={0} size="small" showZero={false}>
                    <BellOutlined style={{ color: "white", fontSize: 20 }} />
                  </Badge>
                </span>
              </Dropdown>
              <Tooltip title="Credits & Information">
                <Button
                  type="text"
                  className="mtc-header-icon"
                  aria-label="Open credits and information"
                  onClick={() => setInformationOpen(true)}
                  icon={<InfoCircleOutlined style={{ color: "white", fontSize: 20 }} />}
                />
              </Tooltip>
              <Dropdown menu={{ items: userMenu }} placement="bottomRight">
                <span className="mtc-header-icon" aria-label="User menu">
                  <Avatar icon={<UserOutlined />} size={32} style={{ cursor: "pointer" }} />
                </span>
              </Dropdown>
            </div>
          </Header>

          <Content style={{ margin: "20px 10px", overflow: "auto", flex: 1, minHeight: 0 }}>
            <div
              className="mtc-content-surface"
              style={{ padding: 20, minHeight: "100%", background: "#FCFCFA", borderRadius: 6 }}
            >
              {children}
            </div>
          </Content>

          <Footer
            className="batik-bg mtc-header-footer"
            style={{
              textAlign: "center",
              color: "white",
              fontSize: 14,
              fontWeight: 400,
              position: "sticky",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 999,
              flexShrink: 0,
            }}
          >
            <span>MTC Inventory System © {new Date().getFullYear()} PT Vuteq Indonesia</span>
            <span style={{ margin: "0 8px" }}>|</span>
            <span>v{APP_VERSION}</span>
          </Footer>
        </Layout>
      </Layout>

      <PrivacyPolicyModal
        open={privacyPolicyOpen}
        onClose={() => setPrivacyPolicyOpen(false)}
      />
      <UpdateLogModal
        open={updateLogOpen}
        onClose={() => setUpdateLogOpen(false)}
        appVersion={APP_VERSION}
      />
      <CreditInformationModal
        open={informationOpen}
        onClose={() => setInformationOpen(false)}
        onOpenUpdateLog={() => setUpdateLogOpen(true)}
        onOpenPrivacyPolicy={() => setPrivacyPolicyOpen(true)}
      />
    </>
  );
}
