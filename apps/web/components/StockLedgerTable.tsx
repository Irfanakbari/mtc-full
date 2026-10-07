'use client';

import { Input, Select, Table, Tag } from 'antd';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchLedger, fetchTransactions, setLedgerQuery, type Ledger, type TransactionType } from '@/store/features/stockSlice';
import type { AppDispatch, RootState } from '@/store/store';

const ledgerTypes: TransactionType[] = ['OPENING_BALANCE', 'STOCK_IN', 'STOCK_OUT', 'SCRAP', 'STOCK_OPNAME_DIFF', 'REVERSAL'];
const transactionTypes: TransactionType[] = ['STOCK_IN', 'STOCK_OUT', 'SCRAP'];

type StockLedgerTableProps = { mode?: 'ledger' | 'transactions' };

export function StockLedgerTable({ mode = 'ledger' }: StockLedgerTableProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { data, query, pagination, loading } = useSelector((state: RootState) => state.stock);
  const availableTypes = mode === 'transactions' ? transactionTypes : ledgerTypes;

  useEffect(() => {
    if (mode === 'transactions' && query.transactionType && !transactionTypes.includes(query.transactionType)) {
      dispatch(setLedgerQuery({ transactionType: undefined, page: 1 }));
      return;
    }
    void dispatch(mode === 'transactions' ? fetchTransactions(query) : fetchLedger(query));
  }, [dispatch, mode, query]);

  return <Table<Ledger>
    className="small-table"
    size="small"
    rowKey="Id"
    loading={loading}
    dataSource={data}
    pagination={{ size: 'small', current: pagination.page, pageSize: pagination.limit, total: pagination.totalItems, showSizeChanger: true, showTotal: (total) => `Total ${total} items`, onChange: (page, limit) => dispatch(setLedgerQuery({ page, limit })) }}
    scroll={{ x: 'max-content', y: 'calc(100vh - 380px)' }}
    style={{ fontSize: 11 }}
    columns={[
      { title: 'Model', dataIndex: ['Item', 'Model'], filterDropdown: ({ confirm }) => <div className="p-2"><Input placeholder="Search item or reference" value={query.search} onChange={(event) => dispatch(setLedgerQuery({ search: event.target.value, page: 1 }))} onPressEnter={() => confirm()} /></div> },
      { title: 'Item Name', dataIndex: ['Item', 'Name'] },
      { title: 'Address', dataIndex: ['Item', 'AddressLocation'] },
      { title: 'Type', dataIndex: 'TransactionType', filterDropdown: ({ confirm }) => <div className="p-2"><Select allowClear className="w-56" placeholder="Transaction type" options={availableTypes.map((value) => ({ value, label: value }))} value={query.transactionType} onChange={(value) => { dispatch(setLedgerQuery({ transactionType: value, page: 1 })); confirm(); }} /></div>, render: (value: TransactionType) => <Tag color={value === 'STOCK_IN' || value === 'OPENING_BALANCE' ? 'success' : value === 'SCRAP' ? 'error' : 'blue'}>{value}</Tag> },
      { title: 'Reference', dataIndex: 'ReferenceDoc' },
      { title: 'Before', dataIndex: 'BalanceBefore', align: 'right' },
      { title: 'Qty In', dataIndex: 'QtyIn', align: 'right', render: (value: string) => Number(value) > 0 ? <span className="text-green-700">+{value}</span> : '-' },
      { title: 'Qty Out', dataIndex: 'QtyOut', align: 'right', render: (value: string) => Number(value) > 0 ? <span className="text-red-700">-{value}</span> : '-' },
      { title: 'After', dataIndex: 'BalanceAfter', align: 'right' },
      { title: 'Actor', dataIndex: 'ActorDisplayName', render: (value: string | undefined, record) => value || record.CreatedBy },
      { title: 'Date', dataIndex: 'TransactionDate', render: (value: string) => new Date(value).toLocaleString('en-GB') },
      { title: 'Notes', dataIndex: 'Notes', render: (value: string | null) => value || '-' },
    ]}
  />;
}
