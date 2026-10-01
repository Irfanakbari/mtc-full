import type { KeyboardEvent, ReactNode } from "react";

export default function ButtonToolbar({
  title,
  icon,
  onClick,
  enable = true,
  loading = false,
}: {
  title: string;
  icon?: ReactNode;
  onClick?: () => void;
  enable?: boolean;
  loading?: boolean;
  danger?: boolean;
}) {
  const active = enable && !loading;
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (active && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <span
      role="button"
      tabIndex={active ? 0 : -1}
      aria-disabled={!active}
      className={`${active ? "hover:cursor-pointer hover:bg-[#3A4E61]" : ""} flex flex-row items-center justify-center gap-1 p-1 text-xs transition-colors ${active ? "text-white" : "text-[#93A8B8]"}`}
      onClick={() => active && onClick?.()}
      onKeyDown={onKeyDown}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon}
      <span>{title}</span>
    </span>
  );
}
