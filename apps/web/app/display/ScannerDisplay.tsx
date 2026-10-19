"use client";

import { ArrowDownOutlined, ArrowUpOutlined, CheckCircleFilled, InboxOutlined, LoadingOutlined, LockOutlined, ScanOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, App, Button, Card, Empty, Form, Input, InputNumber, Modal, Result, Segmented, Table, Tag, type InputRef } from "antd";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { clearDisplayError, clearDisplayItem, lookupDisplayItem, resetDisplayReceipt, setSelectedItem, submitDisplayTransaction, type DisplayItem, type DisplayTransactionInput } from "@/store/features/displaySlice";
import { displayApi } from "@/store/utils/display-api";
import type { AppDispatch, RootState } from "@/store/store";
import { withBasePath } from "@/lib/base-path";
import { isValidDisplayQuantity, stockShortage } from "@/lib/display-quantity";
import styles from "./scanner-display.module.css";
import routeStyles from "./display.module.css";

type FormValues = DisplayTransactionInput & { partNumber: string };

const STOCK_IN_PIN = "12345";

export default function ScannerDisplay() {
  const dispatch = useDispatch<AppDispatch>();
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const partInput = useRef<InputRef>(null);
  const operatorInput = useRef<InputRef>(null);
  const pinInputRef = useRef<InputRef>(null);
  const searchInputRef = useRef<InputRef>(null);
  const pendingCommand = useRef<{ signature: string; key: string } | null>(null);

  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DisplayItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const quantity = Form.useWatch("quantity", form);
  const direction = Form.useWatch("direction", form) ?? "OUT";
  const { selectedItem, loadingItems, submitting, error, receipt } = useSelector((state: RootState) => state.display);

  const shortage = stockShortage(direction, quantity, selectedItem?.CurrentBalance, selectedItem?.Unit);
  const submitBlocked = !selectedItem || submitting || !!shortage || !isValidDisplayQuantity(quantity);

  const resetToStockOut = useCallback((): void => {
    pendingCommand.current = null;
    dispatch(resetDisplayReceipt());
    dispatch(clearDisplayItem());
    dispatch(clearDisplayError());
    form.resetFields();
    form.setFieldsValue({ direction: "OUT", quantity: 1 });
    setPinModalOpen(false);
    setPinValue("");
    setPinError(null);
    setSearchModalOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    window.setTimeout(() => partInput.current?.focus({ cursor: "all" }), 40);
  }, [dispatch, form]);

  const startAnother = useCallback((): void => {
    pendingCommand.current = null;
    dispatch(resetDisplayReceipt());
    dispatch(clearDisplayItem());
    const currentDirection = form.getFieldValue("direction") ?? "OUT";
    form.resetFields();
    form.setFieldsValue({ direction: currentDirection, quantity: 1 });
    window.setTimeout(() => partInput.current?.focus({ cursor: "all" }), 40);
  }, [dispatch, form]);

  useEffect(() => { partInput.current?.focus({ cursor: "all" }); }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        resetToStockOut();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetToStockOut]);

  useEffect(() => {
    if (!receipt) return;
    const next = (event: KeyboardEvent) => {
      if (event.key === "Enter") { event.preventDefault(); startAnother(); }
    };
    window.addEventListener("keydown", next);
    return () => window.removeEventListener("keydown", next);
  }, [receipt, startAnother]);

  function focusQuantity(): void {
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>("input#display-quantity");
      if (!input) return;
      input.focus();
      input.select();
    }, 40);
  }

  function openPinModal(): void {
    setPinValue("");
    setPinError(null);
    setPinModalOpen(true);
    window.setTimeout(() => pinInputRef.current?.focus(), 50);
  }

  function handleVerifyPin(): void {
    if (pinValue === STOCK_IN_PIN) {
      form.setFieldValue("direction", "IN");
      setPinModalOpen(false);
      setPinValue("");
      setPinError(null);
      message.success("Stock In mode activated");
      window.setTimeout(() => partInput.current?.focus({ cursor: "all" }), 40);
    } else {
      setPinError("Invalid PIN. Please enter the correct PIN.");
      setPinValue("");
      window.setTimeout(() => pinInputRef.current?.focus(), 40);
    }
  }

  function handleCancelPin(): void {
    setPinModalOpen(false);
    setPinValue("");
    setPinError(null);
    form.setFieldValue("direction", "OUT");
    window.setTimeout(() => partInput.current?.focus({ cursor: "all" }), 40);
  }

  function handleDirectionChange(nextDir: "IN" | "OUT"): void {
    if (nextDir === "IN") {
      if (direction !== "IN") {
        openPinModal();
      }
    } else {
      form.setFieldValue("direction", "OUT");
    }
  }

  function openSearchModal(): void {
    setSearchModalOpen(true);
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
    window.setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  async function performSearch(query: string): Promise<void> {
    const trimmed = query.trim();
    if (!trimmed) {
      message.warning("Please enter a keyword to search");
      return;
    }
    setSearching(true);
    try {
      const res = await displayApi.search(trimmed);
      setSearchResults(res.data);
      setHasSearched(true);
    } catch (err) {
      message.error(typeof err === "string" ? err : "Failed to search inventory items");
    } finally {
      setSearching(false);
    }
  }

  function selectSearchedItem(item: DisplayItem): void {
    form.setFieldValue("partNumber", item.AddressLocation);
    form.setFields([{ name: "partNumber", errors: [] }]);
    dispatch(setSelectedItem(item));
    setSearchModalOpen(false);
    message.success(`Selected ${item.Name} (${item.AddressLocation})`);
    focusQuantity();
  }

  async function resolvePart(): Promise<void> {
    const partNumber = form.getFieldValue("partNumber")?.trim();
    if (!partNumber) {
      form.setFields([{ name: "partNumber", errors: ["Scan or enter a rack location"] }]);
      partInput.current?.focus();
      return;
    }
    try {
      const result = await dispatch(lookupDisplayItem(partNumber)).unwrap();
      form.setFieldValue("partNumber", result.data.AddressLocation);
      form.setFields([{ name: "partNumber", errors: [] }]);
      message.success("Item verified");
      focusQuantity();
    } catch (lookupError) {
      message.error(typeof lookupError === "string" ? lookupError : "Item was not found");
      window.setTimeout(() => partInput.current?.focus({ cursor: "all" }), 40);
    }
  }

  async function submit(values: FormValues): Promise<void> {
    if (!selectedItem) {
      form.setFields([{ name: "partNumber", errors: ["Verify the item first"] }]);
      partInput.current?.focus({ cursor: "all" });
      return;
    }
    const stockError = stockShortage(values.direction, values.quantity, selectedItem.CurrentBalance, selectedItem.Unit);
    if (stockError || !isValidDisplayQuantity(values.quantity)) {
      form.setFields([{ name: "quantity", errors: [stockError ?? "Enter a positive quantity with no more than two decimals"] }]);
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
      if (typeof submitError === "string" && submitError.startsWith("Insufficient stock")) {
        try { await dispatch(lookupDisplayItem(selectedItem.AddressLocation)).unwrap(); }
        catch { /* A failed refresh clears the selected item and blocks submit. */ }
      }
      operatorInput.current?.focus({ cursor: "end" });
    }
  }

  if (receipt) {
    return (
      <main className={`${styles.page} ${routeStyles.root}`}>
        <div className={styles.shell}>
          <Card className={`${styles.card} ${styles.receiptCard}`}>
            <Result
              status="success"
              icon={<CheckCircleFilled className={styles.successIcon} />}
              title={`Stock ${receipt.direction === "IN" ? "In" : "Out"} Recorded`}
              subTitle={`${receipt.addressLocation} · ${receipt.quantity} ${receipt.unit} · New balance ${receipt.balanceAfter} ${receipt.unit}`}
              extra={
                <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                  <Button type="primary" size="large" onClick={startAnother}>
                    Next Transaction <span className={styles.enterKey}>Enter ↵</span>
                  </Button>
                  <Button size="large" onClick={resetToStockOut}>
                    Reset to Stock Out <span className={styles.enterKey}>ESC</span>
                  </Button>
                </div>
              }
            >
              <div className={styles.receiptDetails}>
                <div><span>Part</span><strong>{receipt.addressLocation} — {receipt.itemName}</strong></div>
                <div><span>Operator</span><strong>{receipt.operatorName}</strong></div>
                <div><span>Reference</span><strong>{receipt.referenceDoc}</strong></div>
              </div>
            </Result>
          </Card>
        </div>
      </main>
    );
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
            <div className={!selectedItem ? styles.activeStep : styles.completeStep}><b>1</b><span>Scan rack location</span></div><i />
            <div className={selectedItem ? styles.activeStep : ""}><b>2</b><span>Enter quantity</span></div><i />
            <div><b>3</b><span>Operator & submit</span></div>
          </div>

          <Form<FormValues> form={form} layout="vertical" size="large" initialValues={{ direction: "OUT", quantity: 1 }} requiredMark={false} onFinish={(values) => void submit(values)} autoComplete="off">
            <Form.Item name="direction" className={styles.directionItem}>
              <Segmented
                block
                size="large"
                className={styles.direction}
                value={direction}
                onChange={(val) => handleDirectionChange(val as "IN" | "OUT")}
                options={[
                  { value: "OUT", label: "Stock Out", icon: <ArrowUpOutlined /> },
                  { value: "IN", label: "Stock In", icon: <ArrowDownOutlined /> }
                ]}
              />
            </Form.Item>

            {error && <Alert className={styles.alert} type="error" showIcon title={error} closable={{ onClose: () => dispatch(clearDisplayError()) }} />}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label htmlFor="rack-location-input" style={{ fontWeight: 700, fontSize: "16px", color: "#293f52" }}>
                Rack Location
              </label>
              <Button
                type="link"
                icon={<SearchOutlined />}
                onClick={openSearchModal}
                style={{ padding: 0, height: "auto", fontSize: "13px", fontWeight: 600, color: "#1d4ed8" }}
              >
                Search by Name / Model / Spec
              </Button>
            </div>

            <Form.Item name="partNumber" rules={[{ required: true, whitespace: true, message: "Scan or enter rack location" }]}>
              <Input
                id="rack-location-input"
                ref={partInput}
                allowClear
                prefix={loadingItems ? <LoadingOutlined spin /> : <ScanOutlined />}
                suffix={<span className={styles.enterHint}>Scan then Enter ↵</span>}
                placeholder="Scan QR/Barcode Rack Location"
                maxLength={120}
                disabled={loadingItems || submitting}
                onChange={() => { if (selectedItem) dispatch(clearDisplayItem()); }}
                onPressEnter={(event) => { event.preventDefault(); void resolvePart(); }}
              />
            </Form.Item>

            {selectedItem && <div className={styles.partCard} aria-live="polite"><CheckCircleFilled /><div className={styles.partIdentity}><span>{selectedItem.Model ?? "Part"}</span><strong>{selectedItem.Name}</strong><span>{selectedItem.Specification}</span></div><div><span>Location</span><strong>{selectedItem.AddressLocation}</strong></div><div><span>Balance</span><strong>{selectedItem.CurrentBalance} {selectedItem.Unit}</strong></div></div>}

            {shortage && <Alert className={styles.alert} type="warning" showIcon title={shortage} role="alert" />}

            <div className={styles.entryGrid}>
              <Form.Item name="quantity" label="Quantity" dependencies={["direction"]} rules={[{ validator: async (_, value) => { const stockError = stockShortage(form.getFieldValue("direction"), value, selectedItem?.CurrentBalance, selectedItem?.Unit); if (stockError) throw new Error(stockError); if (!isValidDisplayQuantity(value)) throw new Error("Enter a positive quantity with no more than two decimals"); } }]}>
                <InputNumber id="display-quantity" className="w-full" suffix={selectedItem?.Unit ?? "Unit"} min={0.01} max={Number.MAX_SAFE_INTEGER} precision={2} step={1} prefix={<InboxOutlined />} disabled={!selectedItem || submitting} onPressEnter={(event) => { event.preventDefault(); operatorInput.current?.focus({ cursor: "all" }); }} />
              </Form.Item>
              <Form.Item name="operatorName" label="Operator Name" rules={[{ required: true, whitespace: true, message: "Enter operator name" }, { pattern: /^[\p{L}\p{N} .'-]{2,80}$/u, message: "Enter a valid operator name" }]}>
                <Input ref={operatorInput} allowClear prefix={<UserOutlined />} suffix={<span className={styles.enterHint}>Enter to submit ↵</span>} placeholder="Type operator name" maxLength={80} disabled={!selectedItem || submitting} onPressEnter={(event) => { event.preventDefault(); form.submit(); }} />
              </Form.Item>
            </div>

            <Button block type="primary" danger={direction === "OUT"} htmlType="submit" loading={submitting} disabled={submitBlocked} icon={direction === "IN" ? <ArrowDownOutlined /> : <ArrowUpOutlined />} className={`${styles.submitButton} ${direction === "IN" ? styles.inButton : ""}`}>Submit Stock {direction === "IN" ? "In" : "Out"}</Button>
          </Form>
        </Card>
        <footer className={styles.footer}>
          <span>Ledger-backed inventory · Press ESC to reset to Stock Out</span>
          <Link href="/auth/login">Administrative access</Link>
        </footer>

        <Modal
          title="Stock In Authorization"
          open={pinModalOpen}
          onOk={handleVerifyPin}
          onCancel={handleCancelPin}
          okText="Authorize"
          cancelText="Cancel"
          destroyOnHidden
          centered
        >
          <div style={{ marginTop: 16 }}>
            <p style={{ marginBottom: 12, color: "#475569" }}>
              Please enter validation PIN to switch to Stock In mode:
            </p>
            {pinError && (
              <Alert
                type="error"
                showIcon
                message={pinError}
                style={{ marginBottom: 12 }}
              />
            )}
            <Input.Password
              ref={pinInputRef}
              prefix={<LockOutlined />}
              placeholder="Enter PIN (e.g. 12345)"
              maxLength={20}
              value={pinValue}
              onChange={(e) => {
                setPinValue(e.target.value);
                if (pinError) setPinError(null);
              }}
              onPressEnter={(e) => {
                e.preventDefault();
                handleVerifyPin();
              }}
              size="large"
            />
          </div>
        </Modal>

        <Modal
          title="Search Item Rack Location"
          open={searchModalOpen}
          onCancel={() => setSearchModalOpen(false)}
          footer={null}
          destroyOnHidden
          centered
          width={760}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
              Search items by name, model, specification, or rack location to find their storage address:
            </p>
            <Input.Search
              ref={searchInputRef}
              size="large"
              placeholder="Search by part name, model, specification, or location..."
              allowClear
              enterButton="Search"
              loading={searching}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={(val) => void performSearch(val)}
            />
            <Table<DisplayItem>
              dataSource={searchResults}
              rowKey="Id"
              loading={searching}
              size="middle"
              pagination={{ pageSize: 5, showSizeChanger: false }}
              locale={{
                emptyText: hasSearched ? (
                  <Empty description="No inventory items found matching your query" />
                ) : (
                  <Empty description="Enter item keywords and click Search to view rack locations" />
                ),
              }}
              columns={[
                {
                  title: "Rack Location",
                  dataIndex: "AddressLocation",
                  key: "AddressLocation",
                  width: 150,
                  render: (address: string) => (
                    <Tag color="blue" style={{ fontSize: "13px", fontWeight: 700, padding: "2px 8px" }}>
                      {address}
                    </Tag>
                  ),
                },
                {
                  title: "Item Details",
                  dataIndex: "Name",
                  key: "Name",
                  render: (name: string, record: DisplayItem) => (
                    <div>
                      <strong style={{ display: "block", color: "#1e293b", fontSize: "14px" }}>{name}</strong>
                      {(record.Model || record.Specification) && (
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          {[record.Model, record.Specification].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  title: "Balance",
                  dataIndex: "CurrentBalance",
                  key: "CurrentBalance",
                  width: 120,
                  align: "right",
                  render: (balance: string, record: DisplayItem) => (
                    <span>
                      <strong>{balance}</strong> <small style={{ color: "#64748b" }}>{record.Unit}</small>
                    </span>
                  ),
                },
                {
                  title: "Action",
                  key: "action",
                  width: 90,
                  align: "center",
                  render: (_: unknown, record: DisplayItem) => (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => selectSearchedItem(record)}
                    >
                      Select
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </Modal>
      </div>
    </main>
  );
}
