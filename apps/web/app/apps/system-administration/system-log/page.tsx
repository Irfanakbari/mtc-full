"use client";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Card, Input, Table, Tag } from "antd";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import { PageHeader } from "@/components/PageHeader";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {
  fetchSystemLogs,
  type ProcessLogRecord,
} from "@/store/features/adminSlice";
import type { AppDispatch, RootState } from "@/store/store";
export default function SystemLogPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { logs, logMeta, loading } = useSelector((s: RootState) => s.admin);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const refresh = () =>
    void dispatch(fetchSystemLogs({ page, limit: 50, search }));
  useEffect(refresh, [dispatch, page, search]);
  return (
    <>
      <PageHeader title="System Log" section="System Administration" />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={refresh}
          loading={loading}
        />
        <Input.Search
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search function or actor"
          className="max-w-sm"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          onSearch={() => {
            setPage(1);
            refresh();
          }}
        />
      </ToolbarWrapper>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<ProcessLogRecord>
          rowKey="Id"
          size="small"
          dataSource={logs}
          loading={loading}
          expandable={{
            expandedRowRender: (r) => (
              <Table
                rowKey="Id"
                size="small"
                pagination={false}
                dataSource={r.Details}
                columns={[
                  {
                    title: "Time",
                    dataIndex: "CreatedAt",
                    render: (v) => new Date(v).toLocaleString("en-GB"),
                  },
                  { title: "Level", dataIndex: "Level" },
                  { title: "Message", dataIndex: "Message" },
                ]}
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize: 50,
            total: logMeta?.totalItems,
            onChange: setPage,
            showSizeChanger: false,
          }}
          columns={[
            {
              title: "Function",
              render: (_, r) => `${r.FunctionId} — ${r.FunctionName}`,
            },
            {
              title: "Status",
              dataIndex: "Status",
              render: (v) => (
                <Tag
                  color={
                    v === "SUCCESS"
                      ? "success"
                      : v === "FAILED"
                        ? "error"
                        : "processing"
                  }
                >
                  {v}
                </Tag>
              ),
            },
            {
              title: "Actor",
              dataIndex: "ActorDisplayName",
              render: (v) => v || "System",
            },
            {
              title: "Started",
              dataIndex: "StartedAt",
              render: (v) => new Date(v).toLocaleString("en-GB"),
            },
            { title: "Message", dataIndex: "Message", ellipsis: true },
          ]}
        />
      </Card>
    </>
  );
}
