import { memo, useMemo } from "react";

interface DiffPreviewProps {
  diff: string;
}

export const DiffPreview = memo(function DiffPreview({ diff }: DiffPreviewProps) {
  const lines = useMemo(() => diff.split(/\r?\n/), [diff]);

  return (
    <div className="grid min-h-0 flex-1 gap-1 overflow-auto rounded-[1rem] border border-white/6 bg-[rgba(0,0,0,0.22)] p-4 font-[var(--font-mono)] text-[0.85rem]">
      {lines.map((line, index) => (
        <div className={getDiffLineClassName(line)} key={`${line}-${index}`}>
          {line || " "}
        </div>
      ))}
    </div>
  );
});

function getDiffLineClassName(line: string) {
  const baseClassName = "whitespace-pre-wrap rounded-[0.4rem] px-1 py-0.5";

  if (line.startsWith("@@")) {
    return `${baseClassName} text-[var(--warning)]`;
  }

  if (
    line.startsWith("diff --git") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ")
  ) {
    return `${baseClassName} text-[var(--accent-2)]`;
  }

  if (line.startsWith("+")) {
    return `${baseClassName} bg-[rgba(80,250,123,0.09)] text-[var(--success)]`;
  }

  if (line.startsWith("-")) {
    return `${baseClassName} bg-[rgba(255,85,85,0.08)] text-[var(--danger)]`;
  }

  return baseClassName;
}
