import { memo, useMemo } from "react";
import { type CodeTokenKind, detectCodeLanguage, tokenizeCodeLine } from "../lib/codeHighlight";

interface CodePreviewProps {
  content: string;
  path: string;
}

export const CodePreview = memo(function CodePreview({ content, path }: CodePreviewProps) {
  const language = useMemo(() => detectCodeLanguage(path), [path]);
  const lines = useMemo(() => buildCodePreviewLines(content, language), [content, language]);

  return (
    <div className="min-h-0 min-w-0 overflow-auto rounded-lg border border-[var(--border-soft)] bg-[#121722] font-[var(--font-mono)] text-[13px] leading-6 text-slate-100">
      <pre className="m-0 min-w-max p-0">
        {lines.map((line) => (
          <div className="grid min-h-6 grid-cols-[3.5rem_minmax(0,1fr)]" key={line.id}>
            <span className="select-none border-r border-white/8 bg-white/[0.025] px-3 text-right text-[11px] text-slate-500">
              {line.number}
            </span>
            <code className="block px-4">
              {line.tokens.map((token) => (
                <span className={TOKEN_CLASS[token.kind]} key={token.id}>
                  {token.text}
                </span>
              ))}
            </code>
          </div>
        ))}
      </pre>
    </div>
  );
});

function buildCodePreviewLines(content: string, language: ReturnType<typeof detectCodeLanguage>) {
  let offset = 0;

  return content.split(/\r\n|\r|\n/).map((text, arrayIndex) => {
    const lineId = `line-${offset}`;
    const tokens = buildTokenParts(text, language);
    offset += text.length + 1;

    return {
      id: lineId,
      number: arrayIndex + 1,
      tokens,
    };
  });
}

function buildTokenParts(line: string, language: ReturnType<typeof detectCodeLanguage>) {
  let offset = 0;

  return tokenizeCodeLine(line, language).map((token) => {
    const id = `token-${offset}-${token.kind}`;
    offset += token.text.length;

    return {
      ...token,
      id,
    };
  });
}

const TOKEN_CLASS: Record<CodeTokenKind, string> = {
  comment: "text-slate-500 italic",
  heading: "text-fuchsia-300 font-semibold",
  key: "text-sky-300",
  keyword: "text-fuchsia-300",
  literal: "text-amber-300",
  number: "text-emerald-300",
  plain: "text-slate-100",
  punctuation: "text-slate-400",
  string: "text-lime-300",
};
