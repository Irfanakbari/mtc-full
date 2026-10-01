import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, type ApiEnvelope, type Pagination } from '../utils/api';

export interface PermissionRecord { Id: string; Action: string; Description: string | null }
export interface RoleRecord { Id: string; Name: string; Description: string | null; IsSystem: boolean; Permissions: PermissionRecord[]; _count: { Users: number } }
export interface UserRecord { Id: string; Name: string; Email: string; IsActive: boolean; RoleId: string | null; Role: RoleRecord | null; LastLogin: string | null }
export interface ApiKeyRecord { Id: string; Name: string; Prefix: string; IsActive: boolean; Permissions: string[]; ExpiresAt: string | null; LastUsedAt: string | null; CreatedAt: string }
export interface ProcessLogRecord { Id: string; FunctionId: string; FunctionName: string; Status: string; Actor: string | null; StartedAt: string; CompletedAt: string | null; Message: string | null; Details: { Id: string; Level: string; Message: string; CreatedAt: string }[] }

interface State {
  users: UserRecord[]; roles: RoleRecord[]; permissions: PermissionRecord[];
  apiKeys: ApiKeyRecord[]; logs: ProcessLogRecord[]; logMeta?: Pagination; loading: boolean;
}
const initialState: State = { users: [], roles: [], permissions: [], apiKeys: [], logs: [], loading: false };
const message = (error: unknown) => error instanceof Error ? error.message : 'Unexpected error';

export const fetchUsers = createAsyncThunk('admin/users', async (_, { rejectWithValue }) => { try { return await api.get<ApiEnvelope<UserRecord[]>>('/users'); } catch (error) { return rejectWithValue(message(error)); } });
export const updateUser = createAsyncThunk('admin/updateUser', async ({ id, data }: { id: string; data: { roleId?: string | null; isActive?: boolean } }, { rejectWithValue }) => { try { return await api.patch<ApiEnvelope<UserRecord>>(`/users/${id}`, data); } catch (error) { return rejectWithValue(message(error)); } });
export const fetchRoles = createAsyncThunk('admin/roles', async (_, { rejectWithValue }) => { try { return await api.get<ApiEnvelope<RoleRecord[]>>('/roles'); } catch (error) { return rejectWithValue(message(error)); } });
export const saveRole = createAsyncThunk('admin/saveRole', async ({ id, data }: { id?: string; data: { name: string; description?: string; permissionIds: string[] } }, { rejectWithValue }) => { try { return id ? await api.patch<ApiEnvelope<RoleRecord>>(`/roles/${id}`, data) : await api.post<ApiEnvelope<RoleRecord>>('/roles', data); } catch (error) { return rejectWithValue(message(error)); } });
export const deleteRole = createAsyncThunk('admin/deleteRole', async (id: string, { rejectWithValue }) => { try { return await api.del<ApiEnvelope<unknown>>(`/roles/${id}`); } catch (error) { return rejectWithValue(message(error)); } });
export const fetchPermissions = createAsyncThunk('admin/permissions', async (_, { rejectWithValue }) => { try { return await api.get<ApiEnvelope<PermissionRecord[]>>('/permissions'); } catch (error) { return rejectWithValue(message(error)); } });
export const createPermission = createAsyncThunk('admin/createPermission', async (data: { action: string; description?: string }, { rejectWithValue }) => { try { return await api.post<ApiEnvelope<PermissionRecord>>('/permissions', data); } catch (error) { return rejectWithValue(message(error)); } });
export const deletePermission = createAsyncThunk('admin/deletePermission', async (id: string, { rejectWithValue }) => { try { return await api.del<ApiEnvelope<unknown>>(`/permissions/${id}`); } catch (error) { return rejectWithValue(message(error)); } });
export const fetchApiKeys = createAsyncThunk('admin/apiKeys', async (_, { rejectWithValue }) => { try { return await api.get<ApiEnvelope<ApiKeyRecord[]>>('/api-keys'); } catch (error) { return rejectWithValue(message(error)); } });
export const createApiKey = createAsyncThunk('admin/createApiKey', async (data: { name: string; permissions: string[]; expiresAt?: string }, { rejectWithValue }) => { try { return await api.post<ApiEnvelope<{ id: string; secret: string; warning: string }>>('/api-keys', data); } catch (error) { return rejectWithValue(message(error)); } });
export const revokeApiKey = createAsyncThunk('admin/revokeKey', async (id: string, { rejectWithValue }) => { try { return await api.post<ApiEnvelope<unknown>>(`/api-keys/${id}/revoke`, {}); } catch (error) { return rejectWithValue(message(error)); } });
export const fetchSystemLogs = createAsyncThunk('admin/logs', async (query: { page?: number; limit?: number; search?: string } = {}, { rejectWithValue }) => { try { return await api.get<ApiEnvelope<ProcessLogRecord[]>>('/system-logs', query); } catch (error) { return rejectWithValue(message(error)); } });

const tracked = [fetchUsers, fetchRoles, fetchPermissions, fetchApiKeys, fetchSystemLogs].flatMap((thunk) => [thunk.pending.type, thunk.fulfilled.type, thunk.rejected.type]);
const slice = createSlice({
  name: 'admin', initialState, reducers: {}, extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.fulfilled, (state, action) => { state.users = action.payload.data; })
      .addCase(fetchRoles.fulfilled, (state, action) => { state.roles = action.payload.data; })
      .addCase(fetchPermissions.fulfilled, (state, action) => { state.permissions = action.payload.data; })
      .addCase(fetchApiKeys.fulfilled, (state, action) => { state.apiKeys = action.payload.data; })
      .addCase(fetchSystemLogs.fulfilled, (state, action) => { state.logs = action.payload.data; state.logMeta = action.payload.meta; })
      .addMatcher((action) => tracked.includes(action.type) && action.type.endsWith('/pending'), (state) => { state.loading = true; })
      .addMatcher((action) => tracked.includes(action.type) && !action.type.endsWith('/pending'), (state) => { state.loading = false; });
  },
});
export default slice.reducer;
