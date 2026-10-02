import { Button, Modal, Typography } from "antd";

const { Paragraph, Text, Title } = Typography;

type PrivacyPolicyModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function PrivacyPolicyModal({ open, onClose }: PrivacyPolicyModalProps) {
  return (
    <Modal
      title="Privacy Policy"
      open={open}
      centered
      onCancel={onClose}
      footer={<Button type="primary" onClick={onClose}>Close</Button>}
      width={820}
      styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
    >
      <Title level={4}>Employee and Operational Data Protection Policy</Title>
      <Paragraph>
        <Text strong>Effective date: </Text>2026. This Privacy Policy explains how MTC Inventory System
        (&quot;MTC&quot;), operated for PT Vuteq Indonesia, processes and protects user, operator, inventory,
        and audit data. It supports Indonesian personal data protection requirements, including Law No. 27
        of 2022 on Personal Data Protection, and internal manufacturing governance.
      </Paragraph>

      <Title level={5}>1. User Identity and Operator Data We Process</Title>
      <Paragraph>
        <Text strong>System users: </Text>User ID, full name, corporate email, SSO identifier, assigned roles
        and permissions, session metadata, and login timestamps. Access and refresh tokens remain server-side.
      </Paragraph>
      <Paragraph>
        <Text strong>Display operators: </Text>The operator name entered on the scanner display is recorded with
        the stock transaction while the authenticated station API-key identity remains the immutable audit actor.
      </Paragraph>

      <Title level={5}>2. Inventory and Warehouse Data</Title>
      <Paragraph>
        Item codes, names, storage addresses, transaction references, quantities, stock-counting records,
        attachments, and immutable ledger entries are processed to operate MTC. The ledger enforces the invariant
        <Text italic> BalanceAfter = BalanceBefore + QtyIn - QtyOut</Text>.
      </Paragraph>

      <Title level={5}>3. Purposes of Data Processing</Title>
      <Paragraph>
        Data is processed to maintain accurate stock balances, execute controlled stock IN, OUT, scrap, and stock
        opname workflows, prevent unauthorized changes, and provide reliable internal and customer audit evidence.
      </Paragraph>

      <Title level={5}>4. Security, Audit Logging, and Infrastructure</Title>
      <Paragraph>
        Records are stored on company-controlled infrastructure. Access is enforced through Vuteq SSO, API-key
        authentication for approved stations, role-based permissions, encrypted transport, server-side sessions,
        and actor-attributed audit logging. Existing ledger records are never edited or deleted.
      </Paragraph>

      <Title level={5}>5. Data Retention and Contact</Title>
      <Paragraph>
        Inventory and audit records are retained according to company governance and applicable manufacturing
        requirements. Contact the PT Vuteq Indonesia IT Department or an authorized system administrator for
        questions about personal or operational records.
      </Paragraph>
    </Modal>
  );
}
