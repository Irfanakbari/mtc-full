"use client";
import {
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  DeleteOutlined,
  DownOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Upload,
} from "antd";
import { useVuteqSso } from "@vuteq/sso-client-react/react";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import { PageHeader } from "@/components/PageHeader";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import { fetchItems } from "@/store/features/itemsSlice";
import {
  approveOpname,
  cancelOpname,
  createOpname,
  downloadOpname,
  downloadOpnameAttachment,
  deleteOpnameAttachment,
  fetchOpname,
  fetchOpnames,
  saveCounts,
  startOpname,
  uploadOpnameAttachment,
  type Opname,
  type OpnameDetail,
} from "@/store/features/opnameSlice";
import type { AppDispatch, RootState } from "@/store/store";
type CreateValues = {
  scope: Opname["Scope"];
  itemIds?: string[];
  notes?: string;
};
export default function InventoryCountingPage() {
  const { message, modal } = App.useApp();
  const { session } = useVuteqSso();
  const dispatch = useDispatch<AppDispatch>();
  const { data, selected, query, pagination, loading, saving } = useSelector(
    (s: RootState) => s.opname,
  );
  const items = useSelector((s: RootState) => s.items.data);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [form] = Form.useForm<CreateValues>();
  const [counts, setCounts] = useState<Record<number, number | null>>({});
  const has = (p: string) =>
    Boolean(
      session?.permissions.includes(p) ||
      session?.permissions.includes("SUPER") ||
      session?.roles.includes("SUPER") ||
      session?.globalRoles.includes("SUPER_ADMINISTRATOR"),
    );
  useEffect(() => {
    void dispatch(fetchOpnames(query));
    void dispatch(
      fetchItems({ page: 1, limit: 200, search: "", active: true }),
    );
  }, [dispatch, query]);
  const loadDetail = async (id: string) => {
    const result = await dispatch(fetchOpname(id)).unwrap();
    setCounts(Object.fromEntries((result.data.Details ?? []).map((detail) => [detail.Id, detail.ActualQty === null ? null : Number(detail.ActualQty)])));
  };
  const view = async (row: Opname) => {
    await loadDetail(row.Id);
    setDetailOpen(true);
  };
  const refresh = () => void dispatch(fetchOpnames(query));
  const create = async () => {
    try {
      await dispatch(createOpname(await form.validateFields())).unwrap();
      message.success("Inventory counting draft created");
      setCreateOpen(false);
      form.resetFields();
      refresh();
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error(e instanceof Error ? e.message : String(e));
    }
  };
  const action = async (type: "start" | "cancel" | "approve") => {
    if (!selected) return;
    try {
      if (type === "start") await dispatch(startOpname(selected.Id)).unwrap();
      if (type === "cancel") await dispatch(cancelOpname(selected.Id)).unwrap();
      if (type === "approve")
        await dispatch(approveOpname({ id: selected.Id })).unwrap();
      message.success(`Inventory counting ${type} completed`);
      await loadDetail(selected.Id);
      refresh();
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };
  const save = async () => {
    if (!selected?.Details) return;
    const rows = selected.Details.filter(
      (d) => counts[d.Id] !== null && counts[d.Id] !== undefined,
    ).map((d) => ({ detailId: d.Id, actualQty: counts[d.Id] as number }));
    try {
      await dispatch(saveCounts({ id: selected.Id, items: rows })).unwrap();
      message.success("Physical counts saved");
      await loadDetail(selected.Id);
      refresh();
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    }
  };
  const progress = useMemo(
    () =>
      selected?.Details?.length
        ? Math.round(
            (selected.Details.filter((d) => d.ActualQty !== null).length /
              selected.Details.length) *
              100,
          )
        : 0,
    [selected],
  );
  return (
    <>
      <PageHeader title="Inventory Counting" section="Warehouse" />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={refresh}
        />
        <ButtonToolbar
          title="Create"
          icon={<PlusOutlined />}
          enable={has("MTC.OPNAME.CREATE")}
          onClick={() => setCreateOpen(true)}
        />
        <Dropdown
          disabled={!selected}
          menu={{
            items: [
              {
                key: "start",
                label: "Start and Snapshot",
                disabled: selected?.Status !== "DRAFT" || !has("MTC.OPNAME.UPDATE"),
                onClick: () => void action("start"),
              },
              {
                key: "approve",
                label: "Approve Variance",
                disabled: selected?.Status !== "IN_PROGRESS" || !has("MTC.OPNAME.APPROVE"),
                onClick: () => modal.confirm({
                  centered: true,
                  title: "Approve inventory counting?",
                  content: "This applies every variance to the authoritative ledger. The creator and counters cannot approve their own session.",
                  onOk: () => action("approve"),
                }),
              },
              {
                key: "cancel",
                label: "Cancel",
                danger: true,
                disabled: !["DRAFT", "IN_PROGRESS"].includes(selected?.Status ?? "") || !has("MTC.OPNAME.CANCEL"),
                onClick: () => modal.confirm({
                  centered: true,
                  title: "Cancel inventory counting?",
                  content: "Cancelling releases the transaction freeze without changing stock balances.",
                  okButtonProps: { danger: true },
                  onOk: () => action("cancel"),
                }),
              },
            ],
          }}
        >
          <span><ButtonToolbar title="Update Status" icon={<DownOutlined />} enable={Boolean(selected)} /></span>
        </Dropdown>
        <Dropdown
          disabled={!selected}
          menu={{
            items: [
              {
                key: "worksheet",
                label: "Download Worksheet",
                onClick: () => selected && void dispatch(downloadOpname({ id: selected.Id, type: "worksheet" })),
              },
              {
                key: "report",
                label: "Download Final Report",
                disabled: selected?.Status !== "COMPLETED",
                onClick: () => selected && void dispatch(downloadOpname({ id: selected.Id, type: "final-report" })),
              },
            ],
          }}
        >
          <span><ButtonToolbar title="Downloads" icon={<DownloadOutlined />} enable={Boolean(selected)} /></span>
        </Dropdown>
      </ToolbarWrapper>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<Opname>
          className="small-table"
          size="small"
          rowKey="Id"
          loading={loading}
          dataSource={data}
          pagination={{
            size: "small",
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.totalItems,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
          }}
          onRow={(record) => ({
            onClick: () => void loadDetail(record.Id),
            onDoubleClick: () => void view(record),
          })}
          rowClassName={(record) => selected?.Id === record.Id ? "ant-table-row-selected" : ""}
          scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
          style={{ fontSize: 11 }}
          columns={[
            {
              title: "",
              width: 45,
              render: (_, r) => (
                <Button
                  type="text"
                  icon={<EyeOutlined />}
                  aria-label={`View ${r.RecordNumber}`}
                  onClick={() => void view(r)}
                />
              ),
            },
            { title: "Record Number", dataIndex: "RecordNumber" },
            {
              title: "Scope",
              dataIndex: "Scope",
              render: (v) => <Tag>{v}</Tag>,
            },
            {
              title: "Status",
              dataIndex: "Status",
              render: (v) => (
                <Tag
                  color={
                    v === "COMPLETED"
                      ? "success"
                      : v === "IN_PROGRESS"
                        ? "processing"
                        : v === "CANCELLED"
                          ? "default"
                          : "blue"
                  }
                >
                  {v}
                </Tag>
              ),
            },
            {
              title: "Progress",
              render: (_, r) => (
                <Progress
                  size="small"
                  percent={
                    r.TotalItems
                      ? Math.round(
                          ((r.CompletedItems ?? 0) / r.TotalItems) * 100,
                        )
                      : 0
                  }
                />
              ),
            },
            { title: "Created By", dataIndex: "CreatedBy" },
            {
              title: "Created At",
              dataIndex: "CreatedAt",
              render: (v) => new Date(v).toLocaleString("en-GB"),
            },
          ]}
        />
      </Card>
      <Modal
        title="Create Inventory Counting"
        open={createOpen}
        centered
        forceRender
        destroyOnHidden
        confirmLoading={saving}
        onOk={create}
        onCancel={() => setCreateOpen(false)}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ scope: "ALL_ACTIVE_ITEMS" }}
        >
          <Form.Item name="scope" label="Scope" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "ALL_ACTIVE_ITEMS", label: "All active items" },
                { value: "SELECTED_ITEMS", label: "Selected items" },
              ]}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.scope !== b.scope}>
            {({ getFieldValue }) =>
              getFieldValue("scope") === "SELECTED_ITEMS" ? (
                <Form.Item
                  name="itemIds"
                  label="Items"
                  rules={[{ required: true }]}
                >
                  <Select
                    mode="multiple"
                    showSearch={{ optionFilterProp: "label" }}
                    options={items.map((i) => ({
                      value: i.Id,
                      label: `${i.Name} — ${i.Model ?? "-"} (${i.AddressLocation})`,
                    }))}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={selected?.RecordNumber ?? "Inventory Counting Detail"}
        open={detailOpen}
        centered
        width={1100}
        footer={null}
        onCancel={() => setDetailOpen(false)}
        destroyOnHidden
      >
        <Space wrap className="mb-3">
          <Tag color="blue">{selected?.Status}</Tag>
          <Progress size="small" percent={progress} style={{ width: 180 }} />
          {selected?.Status === "DRAFT" && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              disabled={!has("MTC.OPNAME.UPDATE")}
              loading={saving}
              onClick={() => void action("start")}
            >
              Start and Snapshot
            </Button>
          )}
          {selected?.Status === "IN_PROGRESS" && (
            <>
              <Button
                icon={<SaveOutlined />}
                disabled={!has("MTC.OPNAME.UPDATE")}
                loading={saving}
                onClick={save}
              >
                Save Counts
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                disabled={!has("MTC.OPNAME.APPROVE") || progress < 100}
                loading={saving}
                onClick={() =>
                  modal.confirm({
                    centered: true,
                    title: "Approve inventory counting?",
                    content:
                      "This applies every variance to the authoritative ledger. The creator and counters cannot approve their own session.",
                    onOk: () => action("approve"),
                  })
                }
              >
                Approve
              </Button>
            </>
          )}
          {["DRAFT", "IN_PROGRESS"].includes(selected?.Status ?? "") && (
            <Button
              danger
              icon={<CloseOutlined />}
              disabled={!has("MTC.OPNAME.CANCEL")}
              onClick={() => void action("cancel")}
            >
              Cancel
            </Button>
          )}
          <Button
            icon={<DownloadOutlined />}
            onClick={() =>
              selected &&
              void dispatch(
                downloadOpname({ id: selected.Id, type: "worksheet" }),
              )
            }
          >
            Worksheet
          </Button>
          {selected?.Status === "COMPLETED" && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                selected &&
                void dispatch(
                  downloadOpname({ id: selected.Id, type: "final-report" }),
                )
              }
            >
              Final Report
            </Button>
          )}
        </Space>
        <Card size="small" title="Supporting Documents" className="mb-3">
          {selected && has("MTC.OPNAME.UPDATE") && (
            <Upload
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              maxCount={1}
              showUploadList={false}
              beforeUpload={async (file) => {
                try {
                  await dispatch(uploadOpnameAttachment({ id: selected.Id, file })).unwrap();
                  message.success("Attachment uploaded");
                  await dispatch(fetchOpname(selected.Id)).unwrap();
                } catch (error) { message.error(error instanceof Error ? error.message : String(error)); }
                return false;
              }}
            >
              <Button icon={<PaperClipOutlined />}>Attach PDF or Image</Button>
            </Upload>
          )}
          <Table
            className="mt-2"
            size="small"
            rowKey="Id"
            pagination={false}
            dataSource={selected?.Attachments ?? []}
            locale={{ emptyText: "No supporting documents" }}
            columns={[
              { title: "File", dataIndex: "OriginalName" },
              { title: "Size", dataIndex: "Size", render: (value: number) => `${(value / 1024).toFixed(1)} KB` },
              { title: "Uploaded By", dataIndex: "CreatedBy" },
              { title: "Actions", render: (_, attachment) => <Space><Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => selected && void dispatch(downloadOpnameAttachment({ id: selected.Id, attachment }))}>Download</Button>{has("MTC.OPNAME.UPDATE") && <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={async () => { if (!selected) return; await dispatch(deleteOpnameAttachment({ id: selected.Id, attachmentId: attachment.Id })).unwrap(); message.success("Attachment deleted"); await dispatch(fetchOpname(selected.Id)).unwrap(); }}>Delete</Button>}</Space> },
            ]}
          />
        </Card>
        <Table<OpnameDetail>
          size="small"
          rowKey="Id"
          pagination={{ pageSize: 20 }}
          dataSource={selected?.Details ?? []}
          scroll={{ x: 900 }}
          columns={[
            { title: "Model", dataIndex: ["Item", "Model"] },
            { title: "Name", dataIndex: ["Item", "Name"] },
            { title: "Address", dataIndex: ["Item", "AddressLocation"] },
            { title: "System Qty", dataIndex: "SystemQty", align: "right" },
            {
              title: "Actual Qty",
              render: (_, r) =>
                selected?.Status === "IN_PROGRESS" ? (
                  <InputNumber
                    min={0}
                    precision={2}
                    value={counts[r.Id]}
                    onChange={(value) =>
                      setCounts((current) => ({ ...current, [r.Id]: value }))
                    }
                  />
                ) : (
                  (r.ActualQty ?? "-")
                ),
            },
            {
              title: "Difference",
              render: (_, r) => {
                const value = counts[r.Id];
                return value === null || value === undefined
                  ? "-"
                  : (value - Number(r.SystemQty)).toFixed(2);
              },
            },
            {
              title: "Counted By",
              dataIndex: "CountedBy",
              render: (v) => v || "-",
            },
          ]}
        />
      </Modal>
    </>
  );
}
