"use client";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { App, Card, Form, Input, InputNumber, Modal, Select } from "antd";
import { useVuteqSso } from "@vuteq/sso-client-react/react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import ButtonToolbar from "@/components/ButtonToolbar";
import { PageHeader } from "@/components/PageHeader";
import { StockLedgerTable } from "@/components/StockLedgerTable";
import ToolbarWrapper from "@/components/ToolbarWrapper";
import { fetchItems } from "@/store/features/itemsSlice";
import { fetchTransactions, mutateStock } from "@/store/features/stockSlice";
import type { AppDispatch, RootState } from "@/store/store";
type Mode = "in" | "out" | "scrap";
type Values = {
  itemId: string;
  quantity: number;
  referenceDoc: string;
  notes?: string;
};
export default function TransactionsPage() {
  const { message } = App.useApp();
  const { session } = useVuteqSso();
  const dispatch = useDispatch<AppDispatch>();
  const items = useSelector((s: RootState) => s.items.data);
  const stock = useSelector((s: RootState) => s.stock);
  const [mode, setMode] = useState<Mode | null>(null);
  const [form] = Form.useForm<Values>();
  useEffect(() => {
    void dispatch(fetchItems({ page: 1, limit: 200, search: "", active: true }));
  }, [dispatch]);
  const has = (p: string) =>
    Boolean(
      session?.permissions.includes(p) ||
      session?.permissions.includes("SUPER") ||
      session?.roles.includes("SUPER") ||
      session?.globalRoles.includes("SUPER_ADMINISTRATOR"),
    );
  const submit = async () => {
    if (!mode) return;
    try {
      await dispatch(
        mutateStock({ type: mode, input: await form.validateFields() }),
      ).unwrap();
      message.success(`Stock ${mode.toUpperCase()} recorded successfully`);
      setMode(null);
      form.resetFields();
      void dispatch(fetchTransactions(stock.query));
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error(e instanceof Error ? e.message : String(e));
    }
  };
  const open = (value: Mode) => {
    form.resetFields();
    setMode(value);
  };
  return (
    <>
      <PageHeader title="Stock Transactions" section="Warehouse" />
      <ToolbarWrapper>
        <ButtonToolbar
          title="Refresh"
          icon={<ReloadOutlined />}
          onClick={() => void dispatch(fetchTransactions(stock.query))}
        />
        <ButtonToolbar
          title="Stock In"
          icon={<ArrowDownOutlined />}
          enable={has("MTC.STOCK.IN")}
          onClick={() => open("in")}
        />
        <ButtonToolbar
          title="Stock Out"
          icon={<ArrowUpOutlined />}
          enable={has("MTC.STOCK.OUT")}
          onClick={() => open("out")}
        />
        <ButtonToolbar
          title="Scrap"
          icon={<DeleteOutlined />}
          enable={has("MTC.STOCK.SCRAP")}
          onClick={() => open("scrap")}
        />
      </ToolbarWrapper>
      <Card variant="borderless" styles={{ body: { padding: 0 } }}>
        <StockLedgerTable mode="transactions" />
      </Card>
      <Modal
        title={mode ? `Record Stock ${mode.toUpperCase()}` : ""}
        open={Boolean(mode)}
        centered
        forceRender
        destroyOnHidden
        confirmLoading={stock.saving}
        onOk={submit}
        onCancel={() => setMode(null)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="itemId"
            label="Inventory Item"
            rules={[{ required: true }]}
          >
            <Select
              showSearch={{ optionFilterProp: "label" }}
              options={items
                .filter((i) => i.IsActive)
                .map((i) => ({
                  value: i.Id,
                  label: `${i.Name} — ${i.Model ?? "-"} (${i.AddressLocation})`,
                }))}
            />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="Quantity"
            rules={[{ required: true, type: "number", min: 0.01 }]}
          >
            <InputNumber min={0.01} precision={2} className="w-full" />
          </Form.Item>
          <Form.Item
            name="referenceDoc"
            label="Reference Document"
            rules={[{ required: true }]}
          >
            <Input maxLength={160} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea maxLength={1000} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
