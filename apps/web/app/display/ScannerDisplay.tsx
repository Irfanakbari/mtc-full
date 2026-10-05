"use client";

import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleFilled, InboxOutlined, LoadingOutlined, ScanOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, InputNumber, Result, Segmented, type InputRef } from "antd";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearDisplayError, clearDisplayItem, lookupDisplayItem, resetDisplayReceipt, submitDisplayTransaction, type DisplayTransactionInput } from "@/store/features/displaySlice";
import type { AppDispatch, RootState } from "@/store/store";
import { withBasePath } from "@/lib/base-path";
import styles from "./scanner-display.module.css";
import routeStyles from "./display.module.css";

type FormValues = DisplayTransactionInput & { partNumber: string };

export default function ScannerDisplay() {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const partInput = useRef<InputRef>(null);
  const operatorInput = useRef<InputRef>(null);
  const pendingCommand = useRef<{ signature: string; key: string } | null>(null);
  const direction = Form.useWatch("direction", form) ?? "IN";
  const { selectedItem, loadingItems, submitting, error, receipt } = useSelector((state: RootState) => state.display);

  useEffect(() => { partInput.current?.focus({ cursor: "all" }); }, []);

  useEffect(() => {
    if (!receipt) return;
    const next = (event: KeyboardEvent) => {
      if (event.key === "Enter") { event.preventDefault(); startAnother(); }
    };
    window.addEventListener("keydown", next);
    return () => window.removeEventListener("keydown", next);
  });

  function focusQuantity(): void {
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>("input#display-quantity");
      if (!input) return;
      input.focus();
      input.select();
    }, 40);
  }

  async function resolvePart(): Promise<void> {
    const partNumber = form.getFieldValue("partNumber")?.trim();
    if (!partNumber) {
      form.setFields([{ name: "partNumber", errors: ["Scan or enter an item code, serial number, or rack location"] }]);
      partInput.current?.focus();
      return;
    }
    try {
      const result = await dispatch(lookupDisplayItem(partNumber)).unwrap();
      form.setFieldValue("partNumber", result.data.ItemCode);
      form.setFields([{ name: "partNumber", errors: [] }]);
      message.success("Item verified");
      focusQuantity();
    } catch (lookupError) {
      message.error(typeof lookupError === "string" ? lookupError : "Item was not found");
      window.setTimeout(() => partInput.current?.focus({ cursor: "all" }), 40);
    }
  }

  function startAnother(): void {
    pendingCommand.current = null;
    dispatch(resetDisplayReceipt());
    dispatch(clearDisplayItem());
    const currentDirection = form.getFieldValue("direction") ?? "IN";
    form.resetFields();
    form.setFieldsValue({ direction: currentDirection, quantity: 1 });
    window.setTimeout(() => partInput.current?.focus({ cursor: "all" }), 40);
  }

  async function submit(values: FormValues): Promise<void> {
    if (!selectedItem) {
      form.setFields([{ name: "partNumber", errors: ["Verify the item first"] }]);
      partInput.current?.focus({ cursor: "all" });
      return;
    }
    dispatch(clearDisplayError());
    const input: DisplayTransactionInput = { direction: values.direction, itemId: selectedItem.Id, quantity: values.quantity, operatorName: values.operatorName.trim().replace(/\s+/g, " ") };
    const signature = JSON.stringify(input);
    if (!pendingCommand.current || pendingCommand.current.signature !== signature) pendingCommand.current = { signature, key: `display:${crypto.randomUUID()}` };
    try {
      await dispatch(submitDisplayTransaction({
        input,
        idempotencyKey: pendingCommand.current.key,
      })).unwrap();
      pendingCommand.current = null;
      message.success("Stock transaction recorded");
    } catch (submitError) {
      message.error(typeof submitError === "string" ? submitError : "Transaction failed");
      operatorInput.current?.focus({ cursor: "end" });
    }
  }

  if (receipt) {
    return <main className={`${styles.page} ${routeStyles.root}`}><div className={styles.shell}><Card className={`${styles.card} ${styles.receiptCard}`}><Result status="success" icon={<CheckCircleFilled className={styles.successIcon} />} title={`Stock ${receipt.direction === "IN" ? "In" : "Out"} Recorded`} subTitle={`${receipt.itemCode} · ${receipt.quantity} ${receipt.unit} · New balance ${receipt.balanceAfter} ${receipt.unit}`} extra={<Button type="primary" size="large" onClick={startAnother}>Next Transaction <span className={styles.enterKey}>Enter ↵</span></Button>}><div className={styles.receiptDetails}><div><span>Part</span><strong>{receipt.itemCode} — {receipt.itemName}</strong></div><div><span>Operator</span><strong>{receipt.operatorName}</strong></div><div><span>Reference</span><strong>{receipt.referenceDoc}</strong></div></div></Result></Card></div></main>;
  }

  return (
    <main className={`${styles.page} ${routeStyles.root}`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.logoWrap}><Image src={withBasePath("/images/vtqw.png")} alt="Vuteq" width={160} height={46} priority /></div>
          <div className={styles.headerCopy}><h1>MTC Stock Station</h1><p>Scan. Verify. Submit.</p></div>
          <div className={styles.stationBadge}><span />Ready</div>
        </header>

        <Card className={styles.card}>
          <div className={styles.progress} aria-label="Transaction steps">
            <div className={!selectedItem ? styles.activeStep : styles.completeStep}><b>1</b><span>Scan item / rack</span></div><i />
            <div className={selectedItem ? styles.activeStep : ""}><b>2</b><span>Enter quantity</span></div><i />
            <div><b>3</b><span>Operator & submit</span></div>
          </div>

          <Form<FormValues> form={form} layout="vertical" size="large" initialValues={{ direction: "IN", quantity: 1 }} requiredMark={false} onFinish={(values) => void submit(values)} autoComplete="off">
            <Form.Item name="direction" className={styles.directionItem}>
              <Segmented block size="large" className={styles.direction} options={[{ value: "IN", label: "Stock In", icon: <ArrowDownOutlined /> }, { value: "OUT", label: "Stock Out", icon: <ArrowUpOutlined /> }]} />
            </Form.Item>

            {error && <Alert className={styles.alert} type="error" showIcon title={error} closable={{ onClose: () => dispatch(clearDisplayError()) }} />}

            <Form.Item name="partNumber" label="Item Code / Serial / Rack Location" rules={[{ required: true, whitespace: true, message: "Scan or enter item code, serial number, or rack location" }]}>
              <Input ref={partInput} allowClear prefix={loadingItems ? <LoadingOutlined spin /> : <ScanOutlined />} suffix={<span className={styles.enterHint}>Scan then Enter ↵</span>} placeholder="Scan QR/Barcode Item Code, Serial Number, or Rack Location" maxLength={160} disabled={loadingItems || submitting} onChange={() => { if (selectedItem) dispatch(clearDisplayItem()); }} onPressEnter={(event) => { event.preventDefault(); void resolvePart(); }} />
            </Form.Item>

            {selectedItem && <div className={styles.partCard} aria-live="polite"><CheckCircleFilled /><div className={styles.partIdentity}><span>{selectedItem.ItemCode}</span><strong>{selectedItem.Name}</strong></div><div><span>Location</span><strong>{selectedItem.AddressLocation}</strong></div><div><span>Balance</span><strong>{selectedItem.CurrentBalance} {selectedItem.Unit}</strong></div></div>}

            <div className={styles.entryGrid}>
              <Form.Item name="quantity" label="Quantity" rules={[{ required: true, message: "Enter quantity" }, { validator: async (_, value) => { if (direction === "OUT" && selectedItem && Number(value) > Number(selectedItem.CurrentBalance)) throw new Error("Quantity exceeds current balance"); } }]}>
                <InputNumber id="display-quantity" className="w-full" suffix={selectedItem?.Unit ?? "Unit"} min={0.01} max={direction === "OUT" && selectedItem ? Number(selectedItem.CurrentBalance) : Number.MAX_SAFE_INTEGER} precision={2} step={1} prefix={<InboxOutlined />} disabled={!selectedItem || submitting} onPressEnter={(event) => { event.preventDefault(); operatorInput.current?.focus({ cursor: "all" }); }} />
              </Form.Item>
              <Form.Item name="operatorName" label="Operator Name" rules={[{ required: true, whitespace: true, message: "Enter operator name" }, { pattern: /^[\p{L}\p{N} .'-]{2,80}$/u, message: "Enter a valid operator name" }]}>
                <Input ref={operatorInput} allowClear prefix={<UserOutlined />} suffix={<span className={styles.enterHint}>Enter to submit ↵</span>} placeholder="Type operator name" maxLength={80} disabled={!selectedItem || submitting} onPressEnter={(event) => { event.preventDefault(); form.submit(); }} />
              </Form.Item>
            </div>

            <Button block type="primary" danger={direction === "OUT"} htmlType="submit" loading={submitting} disabled={!selectedItem || submitting} icon={direction === "IN" ? <ArrowDownOutlined /> : <ArrowUpOutlined />} className={`${styles.submitButton} ${direction === "IN" ? styles.inButton : ""}`}>Submit Stock {direction === "IN" ? "In" : "Out"}</Button>
          </Form>
        </Card>
        <footer className={styles.footer}><span>Ledger-backed inventory · Every movement is auditable</span><Link href="/auth/login">Administrative access</Link></footer>
      </div>
    </main>
  );
}
