"use client";

import { ReloadOutlined } from "@ant-design/icons";
import { Card } from "antd";
import { useDispatch, useSelector } from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import { PageHeader } from "@/components/PageHeader";
import { StockLedgerTable } from "@/components/StockLedgerTable";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import { fetchLedger } from "@/store/features/stockSlice";
import type { AppDispatch, RootState } from "@/store/store";

export default function StockLedgerPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { query, loading } = useSelector((state: RootState) => state.stock);

  return (
    <>
      <PageHeader title="Stock Ledger" section="System Administration" />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void dispatch(fetchLedger(query))}
        />
      </ToolbarWrapper>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <StockLedgerTable />
      </Card>
    </>
  );
}
