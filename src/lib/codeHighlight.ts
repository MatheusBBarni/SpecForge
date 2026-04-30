export type CodeLanguage =
  | "css"
  | "html"
  | "javascript"
  | "json"
  | "markdown"
  | "plaintext"
  | "rust"
  | "typescript"
  | "ocaml"
  | "python"
  | "go"
  | "java"
  | "csharp";

export type CodeTokenKind =
  | "comment"
  | "heading"
  | "key"
  | "keyword"
  | "literal"
  | "number"
  | "plain"
  | "punctuation"
  | "string";

export interface CodeToken {
  kind: CodeTokenKind;
  text: string;
}

const EXTENSION_LANGUAGE: Record<string, CodeLanguage> = {
  css: "css",
  htm: "html",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  mdx: "markdown",
  rs: "rust",
  ts: "typescript",
  tsx: "typescript",
  ml: "ocaml",
  py: "python",
  go: "go",
  java: "java",
  cs: "csharp",
};

const CODE_KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "class",
  "const",
  "continue",
  "default",
  "else",
  "enum",
  "export",
  "extends",
  "fn",
  "for",
  "from",
  "function",
  "if",
  "impl",
  "import",
  "in",
  "interface",
  "let",
  "loop",
  "match",
  "mod",
  "pub",
  "return",
  "self",
  "static",
  "struct",
  "switch",
  "trait",
  "type",
  "use",
  "while",
  "match",
  "let*",
  "open",
  "in",
]);

const LITERALS = new Set([
  "false",
  "null",
  "None",
  "Some",
  "true",
  "undefined",
]);

export function detectCodeLanguage(path: string): CodeLanguage {
  const normalizedPath = path.trim().toLowerCase();
  const fileName = normalizedPath.split(/[\\/]/).pop() ?? "";

  if (fileName === "dockerfile") {
    return "plaintext";
  }

  const extension = fileName.includes(".")
    ? fileName.split(".").pop()
    : undefined;
  return extension
    ? (EXTENSION_LANGUAGE[extension] ?? "plaintext")
    : "plaintext";
}

export function tokenizeCodeLine(
  line: string,
  language: CodeLanguage,
): CodeToken[] {
  if (language === "plaintext") {
    return [{ kind: "plain", text: line }];
  }

  if (language === "json") {
    return tokenizeJsonLine(line);
  }

  if (language === "markdown") {
    return tokenizeMarkdownLine(line);
  }

  if (language === "html") {
    return tokenizeHtmlLine(line);
  }

  return tokenizeGenericCodeLine(line);
}

function tokenizeJsonLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let index = 0;

  while (index < line.length) {
    const next = readJsonToken(line, index);
    tokens.push(next.token);
    index = next.endIndex;
  }

  return tokens.length > 0 ? tokens : [{ kind: "plain", text: "" }];
}

function readJsonToken(line: string, index: number) {
  const char = line[index];

  if (/\s/.test(char)) {
    const endIndex = readWhile(line, index, (value) => /\s/.test(value));
    return {
      endIndex,
      token: { kind: "plain", text: line.slice(index, endIndex) } as CodeToken,
    };
  }

  if (char === '"') {
    return readJsonStringToken(line, index);
  }

  const matchedToken = readJsonMatchedToken(line, index);
  if (matchedToken) {
    return matchedToken;
  }

  return {
    endIndex: index + 1,
    token: {
      kind: /[{}[\]:,]/.test(char) ? "punctuation" : "plain",
      text: char,
    } as CodeToken,
  };
}

function readJsonStringToken(line: string, index: number) {
  const endIndex = readQuotedString(line, index, '"');
  const nextIndex = readWhile(line, endIndex, (value) => /\s/.test(value));

  return {
    endIndex,
    token: {
      kind: line[nextIndex] === ":" ? "key" : "string",
      text: line.slice(index, endIndex),
    } as CodeToken,
  };
}

function readJsonMatchedToken(line: string, index: number) {
  const numberMatch = line
    .slice(index)
    .match(/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i);
  if (numberMatch) {
    return {
      endIndex: index + numberMatch[0].length,
      token: { kind: "number", text: numberMatch[0] } as CodeToken,
    };
  }

  const wordMatch = line.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
  if (!wordMatch) {
    return null;
  }

  return {
    endIndex: index + wordMatch[0].length,
    token: {
      kind: LITERALS.has(wordMatch[0]) ? "literal" : "plain",
      text: wordMatch[0],
    } as CodeToken,
  };
}

function tokenizeMarkdownLine(line: string): CodeToken[] {
  const headingMatch = line.match(/^(\s{0,3}#{1,6})(\s.*)?$/);
  if (headingMatch) {
    return [
      { kind: "heading", text: headingMatch[1] },
      { kind: "plain", text: headingMatch[2] ?? "" },
    ];
  }

  const commentIndex = line.indexOf("<!--");
  if (commentIndex >= 0) {
    return splitAtComment(line, commentIndex);
  }

  return tokenizeGenericCodeLine(line);
}

function tokenizeHtmlLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let index = 0;

  while (index < line.length) {
    const tagMatch = line.slice(index).match(/^<\/?[A-Za-z][^>]*\/?>/);
    if (tagMatch) {
      tokens.push({ kind: "keyword", text: tagMatch[0] });
      index += tagMatch[0].length;
      continue;
    }

    const endIndex = line.indexOf("<", index);
    tokens.push({
      kind: "plain",
      text: line.slice(index, endIndex === -1 ? line.length : endIndex),
    });
    index = endIndex === -1 ? line.length : endIndex;
  }

  return tokens.length > 0 ? tokens : [{ kind: "plain", text: "" }];
}

function tokenizeGenericCodeLine(line: string): CodeToken[] {
  const commentIndex = findLineCommentIndex(line);
  if (commentIndex >= 0) {
    return splitAtComment(line, commentIndex);
  }

  const tokens: CodeToken[] = [];
  let index = 0;

  while (index < line.length) {
    const next = readGenericCodeToken(line, index);
    tokens.push(next.token);
    index = next.endIndex;
  }

  return tokens.length > 0 ? tokens : [{ kind: "plain", text: "" }];
}

function readGenericCodeToken(line: string, index: number) {
  const char = line[index];

  if (char === '"' || char === "'" || char === "`") {
    const endIndex = readQuotedString(line, index, char);
    return {
      endIndex,
      token: { kind: "string", text: line.slice(index, endIndex) } as CodeToken,
    };
  }

  const matchedToken = readGenericMatchedToken(line, index);
  if (matchedToken) {
    return matchedToken;
  }

  return {
    endIndex: index + 1,
    token: {
      kind: /[()[\]{}.,:;=+\-*/<>|&!?]/.test(char) ? "punctuation" : "plain",
      text: char,
    } as CodeToken,
  };
}

function readGenericMatchedToken(line: string, index: number) {
  const numberMatch = line.slice(index).match(/^\b\d+(?:\.\d+)?\b/);
  if (numberMatch) {
    return {
      endIndex: index + numberMatch[0].length,
      token: { kind: "number", text: numberMatch[0] } as CodeToken,
    };
  }

  const wordMatch = line.slice(index).match(/^[A-Za-z_$][A-Za-z0-9_$]*/);
  if (!wordMatch) {
    return null;
  }

  const word = wordMatch[0];
  return {
    endIndex: index + word.length,
    token: {
      kind: LITERALS.has(word)
        ? "literal"
        : CODE_KEYWORDS.has(word)
          ? "keyword"
          : "plain",
      text: word,
    } as CodeToken,
  };
}

function findLineCommentIndex(line: string) {
  const slashIndex = line.indexOf("//");
  const hashIndex = line.trimStart().startsWith("#") ? line.indexOf("#") : -1;

  if (slashIndex === -1) {
    return hashIndex;
  }

  if (hashIndex === -1) {
    return slashIndex;
  }

  return Math.min(slashIndex, hashIndex);
}

function splitAtComment(line: string, commentIndex: number): CodeToken[] {
  const beforeComment = line.slice(0, commentIndex);
  return [
    ...tokenizeGenericCodeLine(beforeComment),
    { kind: "comment", text: line.slice(commentIndex) },
  ];
}

function readQuotedString(line: string, startIndex: number, quote: string) {
  let index = startIndex + 1;

  while (index < line.length) {
    if (line[index] === "\\") {
      index += 2;
      continue;
    }

    if (line[index] === quote) {
      return index + 1;
    }

    index += 1;
  }

  return line.length;
}

function readWhile(
  line: string,
  startIndex: number,
  predicate: (value: string) => boolean,
) {
  let index = startIndex;

  while (index < line.length && predicate(line[index])) {
    index += 1;
  }

  return index;
}
