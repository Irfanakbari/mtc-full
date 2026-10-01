import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import { api, type ApiEnvelope, type Pagination, saveBlob } from "../utils/api";
import type { InventoryItem } from "./itemsSlice";
export type OpnameStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export interface OpnameDetail {
  Id: number;
  ItemId: string;
  SystemQty: string;
  ActualQty: string | null;
  DifferenceQty: string | null;
  CountedBy: string | null;
  Notes: string | null;
  Item: InventoryItem;
}
export interface OpnameAttachment { Id: number; OriginalName: string; MimeType: string; Size: number; CreatedAt: string; CreatedBy: string }
export interface Opname {
  Id: string;
  RecordNumber: string;
  Scope: "SELECTED_ITEMS" | "ALL_ACTIVE_ITEMS";
  Status: OpnameStatus;
  Notes: string | null;
  CreatedAt: string;
  CreatedBy: string;
  StartedAt: string | null;
  CompletedAt: string | null;
  CompletedBy: string | null;
  TotalItems?: number;
  CompletedItems?: number;
  Details?: OpnameDetail[];
  Attachments?: OpnameAttachment[];
}
interface State {
  data: Opname[];
  selected: Opname | null;
  query: { page: number; limit: number; search: string; status?: OpnameStatus };
  pagination: Pagination;
  loading: boolean;
  saving: boolean;
  error: string | null;
}
const initialState: State = {
  data: [],
  selected: null,
  query: { page: 1, limit: 50, search: "" },
  pagination: { page: 1, limit: 50, totalItems: 0, totalPages: 0 },
  loading: false,
  saving: false,
  error: null,
};
const msg = (e: unknown) =>
  e instanceof Error ? e.message : "Unexpected error";
export const fetchOpnames = createAsyncThunk(
  "opname/list",
  async (q: State["query"], { rejectWithValue }) => {
    try {
      return await api.get<ApiEnvelope<Opname[]>>("/inventory-counting", q);
    } catch (e) {
      return rejectWithValue(msg(e));
    }
  },
);
export const fetchOpname = createAsyncThunk(
  "opname/detail",
  async (id: string, { rejectWithValue }) => {
    try {
      return await api.get<ApiEnvelope<Opname>>(`/inventory-counting/${id}`);
    } catch (e) {
      return rejectWithValue(msg(e));
    }
  },
);
export const createOpname = createAsyncThunk(
  "opname/create",
  async (
    input: { scope: Opname["Scope"]; itemIds?: string[]; notes?: string },
    { rejectWithValue },
  ) => {
    try {
      return await api.post<ApiEnvelope<Opname>>("/inventory-counting", input);
    } catch (e) {
      return rejectWithValue(msg(e));
    }
  },
);
export const startOpname = createAsyncThunk(
  "opname/start",
  async (id: string, { rejectWithValue }) => {
    try {
      return await api.post<ApiEnvelope<Opname>>(
        `/inventory-counting/${id}/start`,
        {},
      );
    } catch (e) {
      return rejectWithValue(msg(e));
    }
  },
);
export const saveCounts = createAsyncThunk(
  "opname/count",
  async (
    {
      id,
      items,
    }: {
      id: string;
      items: Array<{ detailId: number; actualQty: number; notes?: string }>;
    },
    { rejectWithValue },
  ) => {
    try {
      return await api.patch<ApiEnvelope<unknown>>(
        `/inventory-counting/${id}/details`,
        { items },
      );
    } catch (e) {
      return rejectWithValue(msg(e));
    }
  },
);
export const approveOpname = createAsyncThunk(
  "opname/approve",
  async (
    { id, notes }: { id: string; notes?: string },
    { rejectWithValue },
  ) => {
    try {
      return await api.post<ApiEnvelope<unknown>>(
        `/inventory-counting/${id}/approve`,
        { confirmedCheck: true, notes },
      );
    } catch (e) {
      return rejectWithValue(msg(e));
    }
  },
);
export const cancelOpname = createAsyncThunk(
  "opname/cancel",
  async (id: string, { rejectWithValue }) => {
    try {
      return await api.post<ApiEnvelope<unknown>>(
        `/inventory-counting/${id}/cancel`,
        {},
      );
    } catch (e) {
      return rejectWithValue(msg(e));
    }
  },
);
export const downloadOpname = createAsyncThunk(
  "opname/download",
  async (
    { id, type }: { id: string; type: "worksheet" | "final-report" },
    { rejectWithValue },
  ) => {
    try {
      saveBlob(
        await api.blob(`/inventory-counting/${id}/${type}`),
        `stock-opname-${id}.${type === "worksheet" ? "xlsx" : "pdf"}`,
      );
    } catch (e) {
      return rejectWithValue(msg(e));
    }
  },
);
export const uploadOpnameAttachment = createAsyncThunk(
  "opname/uploadAttachment",
  async ({ id, file }: { id: string; file: File }, { rejectWithValue }) => {
    try { const data = new FormData(); data.append("file", file); return await api.upload<ApiEnvelope<OpnameAttachment>>(`/inventory-counting/${id}/attachments`, data); }
    catch (e) { return rejectWithValue(msg(e)); }
  },
);
export const downloadOpnameAttachment = createAsyncThunk(
  "opname/downloadAttachment",
  async ({ id, attachment }: { id: string; attachment: OpnameAttachment }, { rejectWithValue }) => {
    try { saveBlob(await api.blob(`/inventory-counting/${id}/attachments/${attachment.Id}`), attachment.OriginalName); }
    catch (e) { return rejectWithValue(msg(e)); }
  },
);
export const deleteOpnameAttachment = createAsyncThunk(
  "opname/deleteAttachment",
  async ({ id, attachmentId }: { id: string; attachmentId: number }, { rejectWithValue }) => {
    try { return await api.del<ApiEnvelope<unknown>>(`/inventory-counting/${id}/attachments/${attachmentId}`); }
    catch (e) { return rejectWithValue(msg(e)); }
  },
);
const slice = createSlice({
  name: "opname",
  initialState,
  reducers: {
    setOpnameQuery(s, a: PayloadAction<Partial<State["query"]>>) {
      s.query = { ...s.query, ...a.payload };
    },
    clearSelectedOpname(s) {
      s.selected = null;
    },
  },
  extraReducers(b) {
    b.addCase(fetchOpnames.pending, (s) => {
      s.loading = true;
    })
      .addCase(fetchOpnames.fulfilled, (s, a) => {
        s.loading = false;
        s.data = a.payload.data;
        if (a.payload.meta) s.pagination = a.payload.meta;
      })
      .addCase(fetchOpname.fulfilled, (s, a) => {
        s.selected = a.payload.data;
      })
      .addMatcher(
        (a) =>
          [
            createOpname.pending.type,
            startOpname.pending.type,
            saveCounts.pending.type,
            approveOpname.pending.type,
            cancelOpname.pending.type,
          ].includes(a.type),
        (s) => {
          s.saving = true;
        },
      )
      .addMatcher(
        (a) =>
          [
            createOpname.fulfilled.type,
            startOpname.fulfilled.type,
            saveCounts.fulfilled.type,
            approveOpname.fulfilled.type,
            cancelOpname.fulfilled.type,
            createOpname.rejected.type,
            startOpname.rejected.type,
            saveCounts.rejected.type,
            approveOpname.rejected.type,
            cancelOpname.rejected.type,
          ].includes(a.type),
        (s) => {
          s.saving = false;
        },
      );
  },
});
export const { setOpnameQuery, clearSelectedOpname } = slice.actions;
export default slice.reducer;
