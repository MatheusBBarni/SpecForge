import { Fragment, memo, useMemo } from "react";

type MarkdownBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string }
  | { type: "code"; text: string };

interface MarkdownDocumentProps {
  content: string;
}

export const MarkdownDocument = memo(function MarkdownDocument({ content }: MarkdownDocumentProps) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="grid gap-4 leading-7 text-[var(--text-main)]">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading": {
            if (block.level === 1) {
              return (
                <h1 className="m-0 text-[1.6rem] font-semibold" key={`heading-${index}`}>
                  {renderInline(block.text)}
                </h1>
              );
            }

            if (block.level === 2) {
              return (
                <h2
                  className="m-0 text-[1.15rem] font-semibold text-[var(--accent-2)]"
                  key={`heading-${index}`}
                >
                  {renderInline(block.text)}
                </h2>
              );
            }

            return (
              <h3 className="m-0 text-base font-semibold" key={`heading-${index}`}>
                {renderInline(block.text)}
              </h3>
            );
          }

          case "paragraph":
            return (
              <p
                className="m-0 text-[var(--text-subtle)]"
                key={`paragraph-${index}`}
              >
                {renderInline(block.text)}
              </p>
            );

          case "list": {
            const ListTag = block.ordered ? "ol" : "ul";

            return (
              <ListTag
                className={`m-0 grid gap-2 pl-5 text-[var(--text-subtle)] ${
                  block.ordered ? "list-decimal" : "list-disc"
                }`}
                key={`list-${index}`}
              >
                {block.items.map((item) => (
                  <li key={`${index}-${item}`}>{renderInline(item)}</li>
                ))}
              </ListTag>
            );
          }

          case "quote":
            return (
              <blockquote
                className="m-0 border-l-[3px] border-[var(--accent)] pl-4 text-[var(--text-subtle)]"
                key={`quote-${index}`}
              >
                {renderInline(block.text)}
              </blockquote>
            );

          case "code":
            return (
              <pre
                className="m-0 overflow-auto rounded-[1rem] border border-white/6 bg-black/25 p-4 font-[var(--font-mono)] text-sm"
                key={`code-${index}`}
              >
                <code>{block.text}</code>
              </pre>
            );
        }
      })}
    </div>
  );
});

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      index += 1;
      continue;
    }

    if (trimmedLine.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push({
        type: "code",
        text: codeLines.join("\n")
      });
      index += 1;
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.*)$/);

    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2]
      });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmedLine)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push({
        type: "list",
        ordered: false,
        items
      });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmedLine)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push({
        type: "list",
        ordered: true,
        items
      });
      continue;
    }

    if (/^>\s?/.test(trimmedLine)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push({
        type: "quote",
        text: quoteLines.join(" ")
      });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length && shouldContinueParagraph(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" ")
    });
  }

  return blocks;
}

function shouldContinueParagraph(line: string) {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return false;
  }

  return !(
    trimmedLine.startsWith("```") ||
    /^#{1,3}\s+/.test(trimmedLine) ||
    /^[-*]\s+/.test(trimmedLine) ||
    /^\d+\.\s+/.test(trimmedLine) ||
    /^>\s?/.test(trimmedLine)
  );
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          className="rounded-[0.45rem] bg-white/5 px-1.5 py-0.5 font-[var(--font-mono)] text-[0.92em]"
          key={`code-${index}`}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`bold-${index}`}>{part.slice(2, -2)}</strong>;
    }

    return <Fragment key={`text-${index}`}>{part}</Fragment>;
  });
}
