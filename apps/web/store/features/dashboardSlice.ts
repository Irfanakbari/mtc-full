import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { api, type ApiEnvelope } from '../utils/api';
import type { Ledger } from './stockSlice';
export interface Dashboard { activeItems:number;totalBalance:string;lowStock:number;outOfStock:number;transactionsToday:number;activeOpname:number;trends:Array<{date:string;stockIn:number;stockOut:number;scrap:number}>;recentTransactions:Ledger[] }
interface State{data:Dashboard|null;loading:boolean;error:string|null}const initialState:State={data:null,loading:false,error:null};
export const fetchDashboard=createAsyncThunk('dashboard/get',async(_,{rejectWithValue})=>{try{return await api.get<ApiEnvelope<Dashboard>>('/dashboard');}catch(e){return rejectWithValue(e instanceof Error?e.message:'Failed to load dashboard');}});
const slice=createSlice({name:'dashboard',initialState,reducers:{},extraReducers:b=>{b.addCase(fetchDashboard.pending,s=>{s.loading=true;}).addCase(fetchDashboard.fulfilled,(s,a)=>{s.loading=false;s.data=a.payload.data;}).addCase(fetchDashboard.rejected,(s,a)=>{s.loading=false;s.error=a.payload as string;});}});export default slice.reducer;
