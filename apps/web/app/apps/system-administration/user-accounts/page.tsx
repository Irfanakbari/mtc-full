'use client';
import { EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Card, Form, Modal, Select, Switch, Table, Tag } from 'antd';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ButtonToolbar from '@/components/ButtonToolbar';
import { PageHeader } from '@/components/PageHeader';
import ToolbarWrapper from '@/components/ToolbarWrapper';
import { fetchRoles, fetchUsers, updateUser, type UserRecord } from '@/store/features/adminSlice';
import type { AppDispatch, RootState } from '@/store/store';

export default function UserAccountsPage() {
  const { message } = App.useApp(); const dispatch = useDispatch<AppDispatch>();
  const { users, roles, loading } = useSelector((state: RootState) => state.admin);
  const [selected, setSelected] = useState<UserRecord>(); const [open, setOpen] = useState(false); const [form] = Form.useForm();
  const refresh = () => { void dispatch(fetchUsers()); void dispatch(fetchRoles()); };
  useEffect(refresh, [dispatch]);
  const save = async () => { try { const values = await form.validateFields(); await dispatch(updateUser({ id: selected!.Id, data: values })).unwrap(); message.success('User account updated'); setOpen(false); refresh(); } catch (error) { if (!(error as { errorFields?: unknown }).errorFields) message.error(String(error)); } };
  return <><PageHeader title="User Accounts" section="System Administration"/><ToolbarWrapper><ButtonToolbar title="Refresh" icon={<ReloadOutlined/>} onClick={refresh} loading={loading}/><ButtonToolbar title="Edit / Update" icon={<EditOutlined/>} enable={Boolean(selected)} onClick={() => { form.setFieldsValue({ roleId: selected?.RoleId, isActive: selected?.IsActive }); setOpen(true); }}/></ToolbarWrapper><Card variant="borderless" styles={{ body: { padding: 0 } }}><Table<UserRecord> rowKey="Id" size="small" loading={loading} dataSource={users} rowSelection={{ type: 'radio', selectedRowKeys: selected ? [selected.Id] : [], onChange: (_, rows) => setSelected(rows[0]) }} columns={[{ title: 'Name', dataIndex: 'Name' }, { title: 'Email', dataIndex: 'Email' }, { title: 'Role', render: (_, row) => row.Role?.Name ?? '-' }, { title: 'Status', dataIndex: 'IsActive', render: (value) => <Tag color={value ? 'success' : 'default'}>{value ? 'Active' : 'Inactive'}</Tag> }, { title: 'Last Login', dataIndex: 'LastLogin', render: (value) => value ? new Date(value).toLocaleString('en-GB') : 'Never' }]}/></Card><Modal title="Update User Account" open={open} centered forceRender onCancel={() => setOpen(false)} onOk={save}><Form form={form} layout="vertical"><Form.Item name="roleId" label="Local Role"><Select allowClear options={roles.map((role) => ({ value: role.Id, label: role.Name }))}/></Form.Item><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch/></Form.Item></Form></Modal></>;
}
