import { HistoryOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Spin, Tag } from "antd";
import { useCallback, useState } from "react";

type ProjectCommit = {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  category: string;
  summary: string;
};

type ProjectCommitHistory = {
  repository: {
    commitCount: number;
    generatedAt: string;
  };
  commits: ProjectCommit[];
};

type UpdateLogModalProps = {
  open: boolean;
  onClose: () => void;
  appVersion: string;
};

const latestReleaseSummary = [
  "Established the MTC inventory monorepo with Vuteq SSO, local IAM, and authenticated BFF architecture.",
  "Implemented authoritative inventory ledger transactions, reconciliation, and auditable stock counting.",
  "Added a scanner-first operator display for fast stock IN and OUT recording.",
  "Separated operational stock transactions from the complete ledger and resolved actor display names.",
  "Integrated the complete Credits & Information workflow and chronological update log.",
];

export default function UpdateLogModal({ open, onClose, appVersion }: UpdateLogModalProps) {
  const [history, setHistory] = useState<ProjectCommitHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/data/project-commit-history.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load update history.");
      setHistory(await response.json() as ProjectCommitHistory);
    } catch {
      setError("Unable to load update history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mtc-credit-title-icon"><HistoryOutlined /></span>
          <div>
            <div style={{ lineHeight: 1.2 }}>Update Log</div>
            <div className="mtc-credit-title-caption">A chronological record of MTC improvements</div>
          </div>
        </div>
      }
      open={open}
      afterOpenChange={(visible) => { if (visible) void loadHistory(); }}
      centered
      onCancel={onClose}
      footer={<Button type="primary" onClick={onClose}>Close</Button>}
      width={860}
      styles={{ body: { maxHeight: "64vh", overflowY: "auto", paddingTop: 8 } }}
    >
      {loading ? (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Spin size="large" description="Loading update history..." />
        </div>
      ) : error ? (
        <Empty description={error}><Button type="primary" onClick={() => void loadHistory()}>Reload</Button></Empty>
      ) : history ? (
        <div>
          <div className="mtc-release-summary">
            <div className="mtc-release-heading">
              <strong>Version {appVersion}</strong>
              <Tag color="blue">Latest release</Tag>
            </div>
            <p>This release combines the latest committed platform improvements with the current inventory system enhancements.</p>
            <ul>{latestReleaseSummary.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>

          <div className="mtc-update-count">
            <div>
              <strong>{history.repository.commitCount} recorded updates</strong>
              <span>From the first project commit to the latest available update.</span>
            </div>
            <Button onClick={() => void loadHistory()}>Reload</Button>
          </div>

          <div className="mtc-update-list">
            {history.commits.map((commit) => (
              <div className="mtc-update-entry" key={commit.hash}>
                <i className={commit.category === "Fix" ? "is-fix" : ""} />
                <div className="mtc-update-entry-heading">
                  <strong>{commit.summary}</strong>
                  <Tag color={commit.category === "Feature" ? "green" : commit.category === "Fix" ? "red" : "blue"}>
                    {commit.category}
                  </Tag>
                </div>
                <div className="mtc-update-meta">
                  <span>#{commit.shortHash}</span>
                  <span>{commit.author}</span>
                  <span>{new Date(commit.date).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
