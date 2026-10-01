import type { ReactNode } from "react";

export default function ToolbarWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="gradient-background my-2 flex w-full flex-row gap-3 border border-[#D9DDDF] p-2 shadow-sm">
      {children}
    </div>
  );
}
