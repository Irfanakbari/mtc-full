"use client";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {
  App,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
} from "antd";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import { PageHeader } from "@/components/PageHeader";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import {
  deleteRole,
  fetchPermissions,
  fetchRoles,
  saveRole,
  type RoleRecord,
} from "@/store/features/adminSlice";
import type { AppDispatch, RootState } from "@/store/store";
export default function RolesPage() {
  const { message } = App.useApp();
  const dispatch = useDispatch<AppDispatch>();
  const { roles, permissions, loading } = useSelector(
    (s: RootState) => s.admin,
  );
  const [selected, setSelected] = useState<RoleRecord>();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const refresh = () => {
    void dispatch(fetchRoles());
    void dispatch(fetchPermissions());
  };
  useEffect(refresh, [dispatch]);
  const edit = (role?: RoleRecord) => {
    setSelected(role);
    form.setFieldsValue(
      role
        ? {
            name: role.Name,
            description: role.Description,
            permissionIds: role.Permissions.map((p) => p.Id),
          }
        : { name: "", description: "", permissionIds: [] },
    );
    setOpen(true);
  };
  const save = async () => {
    try {
      const values = await form.validateFields();
      await dispatch(saveRole({ id: selected?.Id, data: values })).unwrap();
      message.success(selected ? "Role updated" : "Role created");
      setOpen(false);
      refresh();
    } catch (e) {
      if (!(e as { errorFields?: unknown }).errorFields)
        message.error(String(e));
    }
  };
  return (
    <>
      <PageHeader title="Roles Configuration" section="System Administration" />
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
          onClick={() => edit()}
        />
        <ButtonToolbar
          title="Edit / Update"
          icon={<EditOutlined />}
          enable={Boolean(selected)}
          onClick={() => edit(selected)}
        />
        <Popconfirm
          title="Delete this role?"
          disabled={!selected || selected.IsSystem}
          onConfirm={async () => {
            await dispatch(deleteRole(selected!.Id)).unwrap();
            message.success("Role deleted");
            setSelected(undefined);
            refresh();
          }}
        >
          <ButtonToolbar
            title="Delete"
            icon={<DeleteOutlined />}
            danger
            enable={Boolean(selected && !selected.IsSystem)}
          />
        </Popconfirm>
      </ToolbarWrapper>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <Table<RoleRecord>
          rowKey="Id"
          size="small"
          dataSource={roles}
          loading={loading}
          rowSelection={{
            type: "radio",
            selectedRowKeys: selected ? [selected.Id] : [],
            onChange: (_, rows) => setSelected(rows[0]),
          }}
          columns={[
            { title: "Role", dataIndex: "Name" },
            {
              title: "Description",
              dataIndex: "Description",
              render: (v) => v || "-",
            },
            {
              title: "Type",
              dataIndex: "IsSystem",
              render: (v) => (
                <Tag color={v ? "blue" : "default"}>
                  {v ? "System" : "Custom"}
                </Tag>
              ),
            },
            { title: "Users", render: (_, r) => r._count.Users },
            { title: "Permissions", render: (_, r) => r.Permissions.length },
          ]}
        />
      </Card>
      <Modal
        title={selected ? "Edit Role" : "Create Role"}
        open={open}
        centered
        forceRender
        onCancel={() => setOpen(false)}
        onOk={save}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Role Name" rules={[{ required: true }]}>
            <Input disabled={selected?.IsSystem} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea />
          </Form.Item>
          <Form.Item name="permissionIds" label="Permissions">
            <Select
              mode="multiple"
              showSearch={{ optionFilterProp: "label" }}
              options={permissions.map((p) => ({
                value: p.Id,
                label: p.Action,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
