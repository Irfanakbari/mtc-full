import { Breadcrumb } from "antd";

export function PageHeader({ title, section = "MTC" }: { title: string; section?: string }) {
  return (
    <Breadcrumb
      style={{ marginBottom: 16 }}
      items={[{ title: "Home" }, { title: section }, { title }]}
    />
  );
}
