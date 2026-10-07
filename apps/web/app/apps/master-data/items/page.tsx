"use client";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Table,
  Tag,
  Upload,
  type InputRef,
} from "antd";
import type { FilterDropdownProps } from "antd/es/table/interface";
import { useVuteqSso } from "@vuteq/sso-client-react/react";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import { PageHeader } from "@/components/PageHeader";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {
  archiveItem,
  commitImport,
  createItem,
  exportItems,
  downloadImportTemplate,
  fetchItems,
  previewImport,
  reactivateItem,
  setItemQuery,
  setSelectedItem,
  updateItem,
  type InventoryItem,
  type ItemInput,
} from "@/store/features/itemsSlice";
import type { AppDispatch, RootState } from "@/store/store";
const can = (permissions: string[], value: string, roles: string[] = []) =>
  permissions.includes(value) ||
  permissions.includes("SUPER") ||
  roles.includes("SUPER") ||
  roles.includes("SUPER_ADMINISTRATOR");
export default function ItemsPage() {
  const { message, modal } = App.useApp();
  const { session } = useVuteqSso();
  const dispatch = useDispatch<AppDispatch>();
  const { data, selected, query, pagination, loading, saving } = useSelector(
    (s: RootState) => s.items,
  );
  const [form] = Form.useForm<ItemInput>();
  const [editor, setEditor] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<{
    valid: boolean;
    rows: Record<string, unknown>[];
    errors: Array<{ rowNumber: number; field: string; message: string }>;
  } | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const importKey = useRef<string | null>(null);
  const searchRef = useRef<InputRef>(null);
  const permissions = session?.permissions ?? [];
  const roles = session?.roles ?? [];
  useEffect(() => {
    void dispatch(fetchItems(query));
  }, [dispatch, query]);
  const filterProps = (label: string) => ({
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: FilterDropdownProps) => (
      <div className="p-2" onKeyDown={(e) => e.stopPropagation()}>
        <Input
          ref={searchRef}
          placeholder={`Search ${label}`}
          value={selectedKeys[0] as string}
          onChange={(e) =>
            setSelectedKeys(e.target.value ? [e.target.value] : [])
          }
          onPressEnter={() => {
            dispatch(
              setItemQuery({ search: String(selectedKeys[0] ?? ""), page: 1 }),
            );
            confirm();
          }}
        />
        <Space className="mt-2">
          <Button
            size="small"
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              dispatch(
                setItemQuery({
                  search: String(selectedKeys[0] ?? ""),
                  page: 1,
                }),
              );
              confirm();
            }}
          >
            Search
          </Button>
          <Button
            size="small"
            onClick={() => {
              clearFilters?.();
              dispatch(setItemQuery({ search: "", page: 1 }));
              confirm();
            }}
          >
            Reset
          </Button>
        </Space>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
    ),
    filteredValue: query.search ? [query.search] : null,
  });
  const openCreate = () => {
    form.resetFields();
    form.setFieldsValue({ unit: "PCS", minimumStock: 0, openingBalance: 0 });
    dispatch(setSelectedItem(null));
    setEditor(true);
  };
  const openEdit = () => {
    if (!selected) return;
    form.setFieldsValue({
      name: selected.Name,
      model: selected.Model ?? undefined,
      specification: selected.Specification ?? undefined,
      classification: selected.Classification ?? undefined,
      unit: selected.Unit,
      addressLocation: selected.AddressLocation,
      minimumStock: Number(selected.MinimumStock),
    });
    setEditor(true);
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      if (selected)
        await dispatch(updateItem({ id: selected.Id, input: values })).unwrap();
      else await dispatch(createItem(values)).unwrap();
      message.success(
        selected ? "Item updated successfully" : "Item created successfully",
      );
      setEditor(false);
      dispatch(setSelectedItem(null));
      void dispatch(fetchItems(query));
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error(e instanceof Error ? e.message : String(e));
    }
  };
  const archive = () => {
    if (!selected) return;
    modal.confirm({
      centered: true,
      title: "Archive inventory item?",
      content: (
        <Input.TextArea id="archive-reason" placeholder="Archive reason" />
      ),
      okButtonProps: { danger: true },
      onOk: async () => {
        const value = (
          document.getElementById(
            "archive-reason",
          ) as HTMLTextAreaElement | null
        )?.value.trim();
        if (!value) {
          message.error("Archive reason is required");
          throw new Error("Reason required");
        }
        await dispatch(
          archiveItem({ id: selected.Id, reason: value }),
        ).unwrap();
        message.success("Item archived");
        dispatch(setSelectedItem(null));
        void dispatch(fetchItems(query));
      },
    });
  };
  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try { await dispatch(downloadImportTemplate()).unwrap(); }
    catch (e) { message.error(e instanceof Error ? e.message : String(e)); }
    finally { setDownloadingTemplate(false); }
  };
  const handleFile = async (file: File) => {
    setPreview(null);
    importKey.current = null;
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 5 * 1024 * 1024) {
      message.error('Select an XLSX file no larger than 5 MB');
      return Upload.LIST_IGNORE;
    }
    setImporting(true);
    try {
      const result = await dispatch(previewImport(file)).unwrap();
      setPreview(result.data);
      importKey.current = crypto.randomUUID();
      message[result.data.valid ? "success" : "warning"](
        result.data.valid
          ? "Import file is valid"
          : "Import file contains errors",
      );
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
    return false;
  };
  const commit = async () => {
    if (!preview?.valid) return;
    setImporting(true);
    try {
      const result = await dispatch(commitImport({ rows: preview.rows, idempotencyKey: importKey.current ?? (importKey.current = crypto.randomUUID()) })).unwrap();
      message.success(`${result.data.imported} item(s) imported`);
      setImportOpen(false);
      setPreview(null);
      void dispatch(fetchItems(query));
    } catch (e) {
      message.error(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };
  return (
    <>
      <PageHeader title="Inventory Items" section="Master Data" />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => void dispatch(fetchItems(query))}
          loading={loading}
        />
        <ButtonToolbar
          title="Create"
          icon={<PlusOutlined />}
          enable={can(permissions, "MTC.ITEM.CREATE", roles)}
          onClick={openCreate}
        />
        <ButtonToolbar
          title="Edit / Update"
          icon={<EditOutlined />}
          enable={Boolean(
            selected && can(permissions, "MTC.ITEM.UPDATE", roles),
          )}
          onClick={openEdit}
        />
        <ButtonToolbar
          title={selected?.IsActive ? "Archive" : "Reactivate"}
          icon={
              selected?.IsActive ? <DeleteOutlined /> : <CheckCircleOutlined />
          }
          enable={Boolean(
            selected && can(permissions, "MTC.ITEM.ARCHIVE", roles),
          )}
          onClick={() => {
            if (selected?.IsActive) archive();
            else if (selected)
              void dispatch(reactivateItem(selected.Id))
                .unwrap()
                .then(() => {
                  message.success("Item reactivated");
                  void dispatch(fetchItems(query));
                });
          }}
        />
        <ButtonToolbar
          title="Import XLSX"
          icon={<ImportOutlined />}
          enable={can(permissions, "MTC.ITEM.IMPORT", roles)}
          onClick={() => setImportOpen(true)}
        />
        <ButtonToolbar
          title="Export XLSX"
          icon={<DownloadOutlined />}
          enable={can(permissions, "MTC.ITEM.EXPORT", roles)}
          onClick={() => void dispatch(exportItems(query))}
        />
      </ToolbarWrapper>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<InventoryItem>
          className="small-table"
          size="small"
          rowKey="Id"
          loading={loading}
          dataSource={data}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selected ? [selected.Id] : [],
            onChange: (_, rows) => dispatch(setSelectedItem(rows[0] ?? null)),
          }}
          onRow={(record) => ({
            onDoubleClick: () => dispatch(setSelectedItem(record)),
          })}
          pagination={{
            size: "small",
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.totalItems,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} items`,
            onChange: (page, limit) => dispatch(setItemQuery({ page, limit })),
          }}
          scroll={{ x: "max-content", y: "calc(100vh - 380px)" }}
          style={{ fontSize: 11 }}
          columns={[
            { title: "Address Location", dataIndex: "AddressLocation", fixed: "left", ...filterProps("address") },
            { title: "Name", dataIndex: "Name", ...filterProps("name") },
            { title: "Model", dataIndex: "Model", render: (v) => v || "-" },
            { title: "Specification", dataIndex: "Specification", render: (v) => v || "-" },
            { title: "Classification", dataIndex: "Classification", render: (v) => v || "-", ...filterProps("classification") },
            { title: "Unit", dataIndex: "Unit" },
            { title: "Status", dataIndex: "IsActive", render: (v) => <Tag color={v ? "success" : "default"}>{v ? "Active" : "Archived"}</Tag> },
            {
              title: "Balance",
              dataIndex: "CurrentBalance",
              align: "right",
              render: (v) => Number(v).toFixed(2),
            },
            {
              title: "Minimum",
              dataIndex: "MinimumStock",
              align: "right",
              render: (v) => Number(v).toFixed(2),
            },
            {
              title: "Stock Status",
              render: (_, r) =>
                Number(r.CurrentBalance) <= 0 ? (
                  <Tag color="error">Out of stock</Tag>
                ) : Number(r.CurrentBalance) <= Number(r.MinimumStock) ? (
                  <Tag color="warning">Low stock</Tag>
                ) : (
                  <Tag color="success">Available</Tag>
                ),
            },
            {
              title: "Created",
              dataIndex: "CreatedAt",
              render: (v) => new Date(v).toLocaleString("en-GB"),
            },
          ]}
        />
      </Card>
      <Modal
        title={selected ? "Edit Inventory Item" : "Create Inventory Item"}
        open={editor}
        centered
        forceRender
        destroyOnHidden
        confirmLoading={saving}
        onOk={save}
        onCancel={() => setEditor(false)}
        width={760}
      >
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item
              name="name"
              label="Item Name"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="model" label="Model">
              <Input />
            </Form.Item>
            <Form.Item name="specification" label="Specification">
              <Input.TextArea maxLength={1000} rows={3} />
            </Form.Item>
            <Form.Item name="classification" label="Classification">
              <Input />
            </Form.Item>
            <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="addressLocation"
              label="Address Location"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="minimumStock"
              label="Minimum Stock"
              rules={[{ required: true, type: "number", min: 0 }]}
            >
              <InputNumber min={0} precision={2} className="w-full" />
            </Form.Item>
            {!selected && (
              <>
                <Form.Item
                  name="openingBalance"
                  label="Opening Balance"
                  rules={[{ type: "number", min: 0 }]}
                >
                  <InputNumber min={0} precision={2} className="w-full" />
                </Form.Item>
                <Form.Item name="referenceDoc" label="Opening Reference">
                  <Input />
                </Form.Item>
              </>
            )}
          </div>
        </Form>
      </Modal>
      <Modal
        title="Import Inventory Items"
        open={importOpen}
        centered
        destroyOnHidden
        onCancel={() => {
          if (importing) return;
          setImportOpen(false);
          setPreview(null);
        }}
        onOk={commit}
        okText="Commit Import"
        okButtonProps={{ disabled: importing || !preview?.valid }}
        confirmLoading={importing}
        width={1100}
      >
        <Space orientation="vertical" className="w-full">
          <Button icon={<DownloadOutlined />} loading={downloadingTemplate} onClick={() => void downloadTemplate()}>
            Download XLSX Template
          </Button>
          <span>Fill in the template, then upload an XLSX file (maximum 5 MB, 5,000 rows).</span>
          <Upload accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" maxCount={1} disabled={importing} beforeUpload={handleFile} onRemove={() => setPreview(null)}>
            <Button icon={<ImportOutlined />} disabled={importing}>Select XLSX File</Button>
          </Upload>
          {preview && (
            <>
              {preview.valid ? (
                <Tag color="success">
                  Ready to import {preview.rows.length} row(s)
                </Tag>
              ) : (
                <Tag color="error">
                  Fix all validation errors before importing
                </Tag>
              )}
              <Table
                size="small"
                rowKey="rowNumber"
                dataSource={preview.rows}
                pagination={{ pageSize: 10, showSizeChanger: false, showTotal: total => `${total} rows` }}
                scroll={{ x: 1200 }}
                columns={[
                  { title: "Row", dataIndex: "rowNumber", width: 65 },
                  { title: "Address Location", dataIndex: "addressLocation" },
                  { title: "Name", dataIndex: "name" },
                  { title: "Model", dataIndex: "model" },
                  { title: "Specification", dataIndex: "specification" },
                  { title: "Classification", dataIndex: "classification" },
                  { title: "Unit", dataIndex: "unit" },
                  { title: "Opening Balance", dataIndex: "openingBalance" },
                  { title: "Minimum Stock", dataIndex: "minimumStock" },
                  { title: "Reference", dataIndex: "referenceDoc" },
                  { title: "Notes", dataIndex: "notes" },
                ]}
              />
              {preview.errors.length > 0 && <Table
                size="small"
                rowKey={(r) => `${r.rowNumber}-${r.field}`}
                pagination={{ pageSize: 8 }}
                dataSource={preview.errors}
                columns={[
                  { title: "Row", dataIndex: "rowNumber" },
                  { title: "Field", dataIndex: "field" },
                  { title: "Message", dataIndex: "message" },
                ]}
              />}
            </>
          )}
        </Space>
      </Modal>
    </>
  );
}
