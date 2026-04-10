interface DiffPreviewProps {
  diff: string;
}

export function DiffPreview({ diff }: DiffPreviewProps) {
  const lines = diff.split(/\r?\n/);

  return (
    <div className="diff-preview">
      {lines.map((line, index) => (
        <div className={getDiffLineClassName(line)} key={`${line}-${index}`}>
          {line || " "}
        </div>
      ))}
    </div>
  );
}

function getDiffLineClassName(line: string) {
  if (line.startsWith("@@")) {
    return "diff-line diff-line-hunk";
  }

  if (
    line.startsWith("diff --git") ||
    line.startsWith("index ") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ")
  ) {
    return "diff-line diff-line-meta";
  }

  if (line.startsWith("+")) {
    return "diff-line diff-line-add";
  }

  if (line.startsWith("-")) {
    return "diff-line diff-line-remove";
  }

  return "diff-line";
}
