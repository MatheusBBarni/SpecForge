import { Search } from "iconoir-react";
import type { ChangeEvent, RefObject } from "react";

interface FloatingSearchProps {
  value: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function FloatingSearch({ value, inputRef, onChange }: FloatingSearchProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center p-4 lg:left-[72px] lg:items-center lg:p-6">
      <div className="pointer-events-auto flex w-full max-w-[42rem] items-center gap-3 rounded-[1.15rem] border border-[var(--border-soft)] bg-[var(--bg-panel-strong)] px-4 py-4 shadow-[var(--shadow)] backdrop-blur-2xl">
        <Search className="size-5 shrink-0 text-[var(--text-subtle)]" />
        <input
          aria-label="Search workspace"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
          onChange={onChange}
          placeholder="Search SpecForge"
          ref={inputRef}
          value={value}
        />
        <span className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-xs font-medium text-[var(--text-muted)]">
          Esc
        </span>
      </div>
    </div>
  );
}
