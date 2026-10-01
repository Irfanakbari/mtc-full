"use client";
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { App, Card, Form, Input, Modal, Popconfirm, Table } from "antd";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import { PageHeader } from "@/components/PageHeader";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {
  createPermission,
  deletePermission,
  fetchPermissions,
  type PermissionRecord,
} from "@/store/features/adminSlice";
import type { AppDispatch, RootState } from "@/store/store";
export default function PermissionsPage() {
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const { permissions, loading } = useSelector((s: RootState) => s.admin);
  const [selected, setSelected] = useState<PermissionRecord>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const refresh = () => void dispatch(fetchPermissions());
  useEffect(refresh, [dispatch]);
  const save = async () => {
    try {
      await dispatch(createPermission(await form.validateFields())).unwrap();
      message.success("Permission created");
      setOpen(false);
      form.resetFields();
      refresh();
    } catch (e) {
      if (!(e as { errorFields?: unknown }).errorFields)
        message.error(String(e));
    }
  };
  return (
    <>
      <PageHeader title="Permissions Setup" section="System Administration" />
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
          onClick={() => setOpen(true)}
        />
        <Popconfirm
          title="Delete this unassigned permission?"
          disabled={!selected}
          onConfirm={async () => {
            await dispatch(deletePermission(selected!.Id)).unwrap();
            message.success("Permission deleted");
            setSelected(undefined);
            refresh();
          }}
        >
          <ButtonToolbar
            title="Delete"
            icon={<DeleteOutlined />}
            danger
            enable={Boolean(selected)}
          />
        </Popconfirm>
      </ToolbarWrapper>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<PermissionRecord>
          rowKey="Id"
          size="small"
          dataSource={permissions}
          loading={loading}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selected ? [selected.Id] : [],
            onChange: (_, rows) => setSelected(rows[0]),
          }}
          columns={[
            { title: "Action", dataIndex: "Action" },
            {
              title: "Description",
              dataIndex: "Description",
              render: (v) => v || "-",
            },
          ]}
        />
      </Card>
      <Modal
        title="Create Permission"
        open={open}
        centered
        forceRender
        onCancel={() => setOpen(false)}
        onOk={save}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="action"
            label="Action"
            rules={[
              { required: true },
              {
                pattern: /^MTC\.[A-Z0-9_.]+$/,
                message: "Use the MTC.* namespace",
              },
            ]}
          >
            <Input placeholder="MTC.FEATURE.ACTION" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
