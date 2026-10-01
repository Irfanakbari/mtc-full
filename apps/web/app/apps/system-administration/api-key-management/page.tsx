"use client";
import {
  CopyOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import { PageHeader } from "@/components/PageHeader";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {
  createApiKey,
  fetchApiKeys,
  fetchPermissions,
  revokeApiKey,
  type ApiKeyRecord,
} from "@/store/features/adminSlice";
import type { AppDispatch, RootState } from "@/store/store";
export default function ApiKeysPage() {
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const { apiKeys, permissions, loading } = useSelector(
    (s: RootState) => s.admin,
  );
  const [selected, setSelected] = useState<ApiKeyRecord>();
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState<string>();
  const [form] = Form.useForm();
  const refresh = () => {
    void dispatch(fetchApiKeys());
    void dispatch(fetchPermissions());
  };
  useEffect(refresh, [dispatch]);
  const save = async () => {
    try {
      const values = await form.validateFields();
      const result = await dispatch(
        createApiKey({ ...values, expiresAt: values.expiresAt?.toISOString() }),
      ).unwrap();
      setSecret(result.data.secret);
      message.success("API key created");
      refresh();
    } catch (e) {
      if (!(e as { errorFields?: unknown }).errorFields)
        message.error(String(e));
    }
  };
  return (
    <>
      <PageHeader title="API Key Management" section="System Administration" />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={refresh}
          loading={loading}
        />
        <ButtonToolbar
          title="Create"
          icon={<PlusOutlined />}
          onClick={() => {
            setSecret(undefined);
            form.resetFields();
            setOpen(true);
          }}
        />
        <Popconfirm
          title="Revoke this API key?"
          disabled={!selected?.IsActive}
          onConfirm={async () => {
            await dispatch(revokeApiKey(selected!.Id)).unwrap();
            message.success("API key revoked");
            setSelected(undefined);
            refresh();
          }}
        >
          <ButtonToolbar
            title="Revoke"
            icon={<StopOutlined />}
            danger
            enable={Boolean(selected?.IsActive)}
          />
        </Popconfirm>
      </ToolbarWrapper>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<ApiKeyRecord>
          rowKey="Id"
          size="small"
          dataSource={apiKeys}
          loading={loading}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selected ? [selected.Id] : [],
            onChange: (_, rows) => setSelected(rows[0]),
          }}
          columns={[
            { title: "Name", dataIndex: "Name" },
            { title: "Prefix", dataIndex: "Prefix" },
            {
              title: "Status",
              dataIndex: "IsActive",
              render: (v) => (
                <Tag color={v ? "success" : "default"}>
                  {v ? "Active" : "Revoked"}
                </Tag>
              ),
            },
            { title: "Permissions", render: (_, r) => r.Permissions.length },
            {
              title: "Expires",
              dataIndex: "ExpiresAt",
              render: (v) =>
                v ? new Date(v).toLocaleString("en-GB") : "Never",
            },
            {
              title: "Last Used",
              dataIndex: "LastUsedAt",
              render: (v) =>
                v ? new Date(v).toLocaleString("en-GB") : "Never",
            },
          ]}
        />
      </Card>
      <Modal
        title="Create API Key"
        open={open}
        centered
        forceRender
        mask={{ closable: !secret }}
        closable={!secret}
        cancelButtonProps={{ style: secret ? { display: "none" } : undefined }}
        okText={secret ? "I have copied the secret" : "Create"}
        onCancel={() => setOpen(false)}
        onOk={() => (secret ? setOpen(false) : void save())}
      >
        {secret ? (
          <Space orientation="vertical" className="w-full">
            <Typography.Text type="warning">
              Copy this secret now. It will not be shown again.
            </Typography.Text>
            <Input.TextArea readOnly autoSize value={secret} />
            <Button
              icon={<CopyOutlined />}
              onClick={() =>
                void navigator.clipboard
                  .writeText(secret)
                  .then(() => message.success("Secret copied"))
              }
            >
              Copy secret
            </Button>
          </Space>
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="permissions"
              label="Permissions"
              rules={[{ required: true }]}
            >
              <Select
                mode="multiple"
                showSearch={{ optionFilterProp: "label" }}
                options={permissions.map((p) => ({
                  value: p.Action,
                  label: p.Action,
                }))}
              />
            </Form.Item>
            <Form.Item name="expiresAt" label="Expiry">
              <DatePicker showTime className="w-full" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  );
}
