import { configureStore } from '@reduxjs/toolkit';
import items from './features/itemsSlice';import stock from './features/stockSlice';import opname from './features/opnameSlice';import dashboard from './features/dashboardSlice';import admin from './features/adminSlice';
export const store=configureStore({reducer:{items,stock,opname,dashboard,admin}});export type RootState=ReturnType<typeof store.getState>;export type AppDispatch=typeof store.dispatch;
