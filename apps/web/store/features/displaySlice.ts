import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { displayApi } from "../utils/display-api";

export interface DisplayItem {
  Id: string;
  ItemCode: string;
  Name: string;
  Unit: string;
  AddressLocation: string;
  CurrentBalance: string;
}

export interface DisplayTransactionInput {
  direction: "IN" | "OUT";
  operatorName: string;
  itemId: string;
  quantity: number;
}

export interface DisplayReceipt {
  ledgerId?: string;
  transactionDate?: string;
  itemCode?: string;
  itemName?: string;
  unit?: string;
  balanceAfter?: string;
  direction: "IN" | "OUT";
  quantity: number;
  referenceDoc: string;
  operatorName: string;
}

interface DisplayState {
  selectedItem: DisplayItem | null;
  loadingItems: boolean;
  submitting: boolean;
  error: string | null;
  receipt: DisplayReceipt | null;
}

const initialState: DisplayState = { selectedItem: null, loadingItems: false, submitting: false, error: null, receipt: null };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Unexpected error";

export const lookupDisplayItem = createAsyncThunk("display/lookup", async (partNumber: string, { rejectWithValue }) => {
  try { return await displayApi.lookup(partNumber); }
  catch (error) { return rejectWithValue(errorMessage(error)); }
});

export const submitDisplayTransaction = createAsyncThunk("display/transact", async ({ input, idempotencyKey }: { input: DisplayTransactionInput; idempotencyKey: string }, { rejectWithValue }) => {
  try { return await displayApi.transact(input, idempotencyKey); }
  catch (error) { return rejectWithValue(errorMessage(error)); }
});

const slice = createSlice({
  name: "display",
  initialState,
  reducers: {
    resetDisplayReceipt(state) { state.receipt = null; state.error = null; },
    clearDisplayError(state) { state.error = null; },
    clearDisplayItem(state) { state.selectedItem = null; state.error = null; },
  },
  extraReducers(builder) {
    builder
      .addCase(lookupDisplayItem.pending, (state) => { state.loadingItems = true; state.selectedItem = null; state.error = null; })
      .addCase(lookupDisplayItem.fulfilled, (state, action) => { state.loadingItems = false; state.selectedItem = action.payload.data; state.error = null; })
      .addCase(lookupDisplayItem.rejected, (state, action) => { state.loadingItems = false; state.error = action.payload as string; })
      .addCase(submitDisplayTransaction.pending, (state) => { state.submitting = true; state.error = null; })
      .addCase(submitDisplayTransaction.fulfilled, (state, action) => { state.submitting = false; state.receipt = action.payload.data; })
      .addCase(submitDisplayTransaction.rejected, (state, action) => { state.submitting = false; state.error = action.payload as string; });
  },
});

export const { resetDisplayReceipt, clearDisplayError, clearDisplayItem } = slice.actions;
export default slice.reducer;
