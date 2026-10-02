import {
  DesktopOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Modal } from "antd";
import Image from "next/image";
import { useState } from "react";
import { withBasePath } from "@/lib/base-path";

type CreditInformationModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenUpdateLog: () => void;
  onOpenPrivacyPolicy: () => void;
};

const itTeam = [
  "Irfan Akbari Habibi",
  "Om Wissa",
  "Om Selpian",
  "Mas Sirojul Kahfi",
];

const planControlTeam = ["Aris Budianto", "Febriansyah"];
const advisors = ["Nakajima-san", "Pak Supriadi", "Pak Abdillah", "Pak Sugiono", "Pak Agus Budiono"];

function developmentDays() {
  const projectStartDate = new Date("2026-10-01T00:00:00+07:00");
  const today = new Date();
  let total = 0;
  const current = new Date(projectStartDate);

  while (current <= today) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) total += 1;
    current.setDate(current.getDate() + 1);
  }
  return total;
}

export default function CreditInformationModal({
  open,
  onClose,
  onOpenUpdateLog,
  onOpenPrivacyPolicy,
}: CreditInformationModalProps) {
  const [technologyStackOpen, setTechnologyStackOpen] = useState(false);
  const totalDevelopmentDays = developmentDays();

  return (
    <Modal
      className="mtc-credit-modal"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mtc-credit-title-icon"><InfoCircleOutlined /></span>
          <div>
            <div style={{ lineHeight: 1.2 }}>Credits &amp; Information</div>
            <div className="mtc-credit-title-caption">The people behind MTC</div>
          </div>
        </div>
      }
      open={open}
      centered
      onCancel={onClose}
      footer={[
        <Button key="update-log" onClick={() => { onClose(); onOpenUpdateLog(); }}>
          Update Log
        </Button>,
        <Button key="tech-stack" onClick={() => setTechnologyStackOpen(true)}>
          Tech Stack
        </Button>,
        <Button key="privacy-policy" onClick={() => { onClose(); onOpenPrivacyPolicy(); }}>
          Privacy Policy
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>Close</Button>,
      ]}
      width={820}
    >
      <div className="mtc-credit-content" style={{ padding: "12px 0 4px" }}>
        <div className="mtc-credit-hero">
          <div className="mtc-credit-shimmer" />
          <HeartOutlined className="mtc-credit-watermark" />
          <div className="mtc-credit-heart"><HeartOutlined /></div>
          <h2>MTC - Inventory System</h2>
          <p>Crafted through the collaboration of IT and Operations Teams</p>
        </div>

        <div className="mtc-credit-grid">
          <div className="mtc-credit-column">
            <div className="mtc-credit-developer">
              <div className="mtc-credit-eyebrow">Core Developer</div>
              <div className="mtc-credit-developer-name">Irfan Akbari Habibi</div>
              <div className="mtc-credit-quote">
                “Precision in logic, excellence in execution — crafting digital tools that empower manufacturing every day.”
              </div>
            </div>
            <div className="mtc-development-days">
              <div>Total Development Days</div>
              <strong>{totalDevelopmentDays}</strong>
              <div>Days (October 2026 - Present)</div>
            </div>
            <div className="mtc-credit-quality-quote">
              “Quality is built into the process: zero defects through thoughtful design and continuous kaizen.”
            </div>
          </div>

          <div className="mtc-credit-column">
            <div className="mtc-credit-team-grid">
              <TeamList title="IT Department" icon={<DesktopOutlined />} names={itTeam} color="#4C6A85" />
              <TeamList title="Plan Control Dept" icon={<UserOutlined />} names={planControlTeam} color="#93A8B8" />
            </div>
            <div className="mtc-credit-advisors">
              <h4>⭐ Project Advisors</h4>
              <div>
                {advisors.map((name) => <span key={name}><i />{name}</span>)}
              </div>
            </div>
            <div className="mtc-credit-promise">
              “Code is not just instructions for machines; it is a promise to the people who use it.”
            </div>
          </div>
        </div>

        <div className="mtc-credit-project-started">
          Project Started: October 2026 | Developed with{" "}
          <HeartOutlined />{" "}by IT Teams
        </div>
      </div>

      <Modal
        title="Technology Stack"
        open={technologyStackOpen}
        centered
        onCancel={() => setTechnologyStackOpen(false)}
        footer={<Button type="primary" onClick={() => setTechnologyStackOpen(false)}>Close</Button>}
        width={520}
      >
        <div className="mtc-security-stack">
          <div className="mtc-credit-eyebrow">Security Powered by</div>
          <div className="mtc-security-badges">
            <Image src={withBasePath("/images/ssl.png")} alt="SSL Secured" width={120} height={30} style={{ objectFit: "contain" }} />
            <Image src={withBasePath("/images/aes.webp")} alt="AES 256 Encryption" width={60} height={60} style={{ objectFit: "contain" }} />
          </div>
        </div>
      </Modal>
    </Modal>
  );
}

function TeamList({ title, icon, names, color }: { title: string; icon: React.ReactNode; names: string[]; color: string }) {
  return (
    <div>
      <h4 className="mtc-credit-team-title">{icon}{title}</h4>
      <ul className="mtc-credit-team-list">
        {names.map((name) => <li key={name}><span style={{ background: color }} />{name}</li>)}
      </ul>
    </div>
  );
}
