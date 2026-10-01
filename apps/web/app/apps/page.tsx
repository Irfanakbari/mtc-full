"use client";

import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchDashboard } from "@/store/features/dashboardSlice";
import type { AppDispatch, RootState } from "@/store/store";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const sectionCardStyle = { borderRadius: 10 };
const metricCards = [
  { key: "activeItems", title: "Active items", color: "#1677ff", icon: <DatabaseOutlined /> },
  { key: "totalBalance", title: "Total balance", color: "#52c41a", icon: <CheckCircleOutlined /> },
  { key: "lowStock", title: "Low stock", color: "#faad14", icon: <WarningOutlined /> },
  { key: "outOfStock", title: "Out of stock", color: "#cf1322", icon: <AlertOutlined /> },
  { key: "transactionsToday", title: "Transactions today", color: "#13c2c2", icon: <ClockCircleOutlined /> },
  { key: "activeOpname", title: "Active counting", color: "#722ed1", icon: <CheckCircleOutlined /> },
] as const;

export default function DashboardPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((state: RootState) => state.dashboard);
  const loadDashboard = useCallback(() => dispatch(fetchDashboard()), [dispatch]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  if (loading && !data) {
    return (
      <>
        <Skeleton.Input active block style={{ height: 54, marginBottom: 16 }} />
        <Row gutter={[12, 12]}>
          {metricCards.map((metric) => <Col xs={24} sm={12} md={8} xl={4} key={metric.key}><Card><Skeleton active paragraph={false} /></Card></Col>)}
        </Row>
      </>
    );
  }

  const values = {
    activeItems: data?.activeItems ?? 0,
    totalBalance: Number(data?.totalBalance ?? 0),
    lowStock: data?.lowStock ?? 0,
    outOfStock: data?.outOfStock ?? 0,
    transactionsToday: data?.transactionsToday ?? 0,
    activeOpname: data?.activeOpname ?? 0,
  };

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Inventory Dashboard</Typography.Title>
          <Typography.Text type="secondary">Stock position, transaction movement, and inventory-counting activity</Typography.Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadDashboard()}>Refresh</Button>
      </div>

      {error && <Alert type="error" title={error} showIcon className="mb-4" />}

      <Row gutter={[12, 12]}>
        {metricCards.map((metric) => (
          <Col xs={24} sm={12} md={8} xl={4} key={metric.key}>
            <Card
              style={{ ...sectionCardStyle, height: "100%", borderTop: `3px solid ${metric.color}` }}
              styles={{ body: { padding: 14 } }}
            >
              <Statistic
                title={metric.title}
                value={values[metric.key]}
                formatter={(value) => numberFormatter.format(Number(value))}
                prefix={<span style={{ color: metric.color, fontSize: 18 }}>{metric.icon}</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={16}>
          <Card
            title="Seven-day stock movement"
            extra={<Typography.Text type="secondary">IN vs. OUT vs. SCRAP</Typography.Text>}
            style={sectionCardStyle}
          >
            {(data?.trends.length ?? 0) > 0 ? (
              <div style={{ width: "100%", height: 330 }}>
                <ResponsiveContainer>
                  <ComposedChart data={data?.trends ?? []} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ChartTooltip />
                    <Legend />
                    <Bar dataKey="stockIn" name="Stock In" fill="#52c41a" />
                    <Bar dataKey="stockOut" name="Stock Out" fill="#1677ff" />
                    <Line dataKey="scrap" name="Scrap" stroke="#cf1322" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : <Empty description="No stock movement is available" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Stock attention" style={{ ...sectionCardStyle, height: "100%" }}>
            <div className="grid gap-3">
              <div className="rounded border border-amber-200 bg-amber-50 p-4">
                <Typography.Text type="secondary">Low-stock items</Typography.Text>
                <div className="mt-1 text-2xl font-semibold text-amber-700">{values.lowStock}</div>
              </div>
              <div className="rounded border border-red-200 bg-red-50 p-4">
                <Typography.Text type="secondary">Out-of-stock items</Typography.Text>
                <div className="mt-1 text-2xl font-semibold text-red-700">{values.outOfStock}</div>
              </div>
              <div className="rounded border border-violet-200 bg-violet-50 p-4">
                <Typography.Text type="secondary">Active inventory counting</Typography.Text>
                <div className="mt-1 text-2xl font-semibold text-violet-700">{values.activeOpname}</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Card title="Recent transactions" style={{ ...sectionCardStyle, marginTop: 16 }}>
        <Table
          className="small-table"
          size="small"
          rowKey="Id"
          pagination={false}
          dataSource={data?.recentTransactions ?? []}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: "No recent transactions" }}
          columns={[
            { title: "Item Code", dataIndex: ["Item", "ItemCode"] },
            { title: "Item Name", dataIndex: ["Item", "Name"] },
            { title: "Address", dataIndex: ["Item", "AddressLocation"] },
            { title: "Type", dataIndex: "TransactionType", render: (value) => <Tag>{value}</Tag> },
            { title: "Reference", dataIndex: "ReferenceDoc" },
            { title: "Quantity", align: "right", render: (_, row) => Number(row.QtyIn) > 0 ? `+${row.QtyIn}` : `-${row.QtyOut}` },
            { title: "Actor", dataIndex: "CreatedBy" },
            { title: "Date", dataIndex: "TransactionDate", render: (value) => new Date(value).toLocaleString("en-GB") },
          ]}
        />
      </Card>

      <Typography.Text type="secondary" className="mt-4 block">
        Inventory Ledger is the authoritative stock record. Dashboard balances are cached and reconciled on every stock mutation.
      </Typography.Text>
    </>
  );
}
