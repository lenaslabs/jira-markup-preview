function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function renderInline(text: string): string {
  let html = escapeHtml(text);

  html = html.replace(/\{\{([^{}]+)\}\}/g, (_match, code: string) => {
    return `<code>${escapeHtml(code)}</code>`;
  });

  html = html.replace(/\[([^|\]]+)\|([^\]]+)\]/g, (_match, label: string, href: string) => {
    const safeHref = sanitizeUrl(href.trim());
    const safeLabel = escapeHtml(label.trim());

    if (!safeHref) {
      return safeLabel;
    }

    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });

  html = html.replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>");
  html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  return html;
}

type TableRow = {
  isHeader: boolean;
  cells: string[];
  line: number;
};

function parseTableRow(line: string, lineNumber: number): TableRow | null {
  if (!line.startsWith("|")) {
    return null;
  }

  const isHeader = line.startsWith("||");
  const delimiter = isHeader ? "||" : "|";

  const normalized = line.endsWith(delimiter)
    ? line.slice(0, -delimiter.length)
    : line;

  const cells = normalized
    .split(delimiter)
    .filter((cell, index) => !(index === 0 && cell === ""))
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);

  if (cells.length === 0) {
    return null;
  }

  return { isHeader, cells, line: lineNumber };
}

export function renderJiraMarkup(source: string): string {
  const lines = source.split(/\r?\n/);
  const out: string[] = [];

  let inCodeBlock = false;
  let codeBlockLanguage = "";
  let codeBlockStartLine = 0;
  let inUl = false;
  let ulLine = 0;
  let inOl = false;
  let olLine = 0;
  let tableRows: TableRow[] = [];

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  const flushTable = () => {
    if (tableRows.length === 0) {
      return;
    }

    const tableLine = tableRows[0].line;
    const hasHeader = tableRows[0].isHeader;
    const headerRow = hasHeader ? tableRows[0] : undefined;
    const bodyRows = hasHeader ? tableRows.slice(1) : tableRows;

    out.push(`<table data-line="${tableLine}">`);

    if (headerRow) {
      out.push("<thead><tr>");
      for (const cell of headerRow.cells) {
        out.push(`<th>${renderInline(cell)}</th>`);
      }
      out.push("</tr></thead>");
    }

    out.push("<tbody>");
    for (const row of bodyRows) {
      out.push("<tr>");
      for (const cell of row.cells) {
        out.push(`<td>${renderInline(cell)}</td>`);
      }
      out.push("</tr>");
    }
    out.push("</tbody></table>");

    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    const codeFence = trimmed.match(/^\{code(?::([^}]+))?\}$/);
    if (codeFence) {
      flushTable();
      closeLists();

      if (!inCodeBlock) {
        codeBlockStartLine = i;
        codeBlockLanguage = codeFence[1] ? escapeHtml(codeFence[1].trim()) : "";
        const classAttr = codeBlockLanguage
          ? ` class="language-${codeBlockLanguage}"`
          : "";

        out.push(`<pre data-line="${codeBlockStartLine}"><code${classAttr}>`);
        inCodeBlock = true;
      } else {
        out.push("</code></pre>");
        inCodeBlock = false;
        codeBlockLanguage = "";
      }
      continue;
    }

    if (inCodeBlock) {
      out.push(escapeHtml(rawLine));
      continue;
    }

    const tableRow = parseTableRow(trimmed, i);
    if (tableRow) {
      closeLists();
      tableRows.push(tableRow);
      continue;
    }
    flushTable();

    if (!trimmed) {
      closeLists();
      out.push("");
      continue;
    }

    const heading = trimmed.match(/^h([1-6])\.\s+(.*)$/);
    if (heading) {
      closeLists();
      out.push(
        `<h${heading[1]} data-line="${i}">${renderInline(heading[2])}</h${heading[1]}>`
      );
      continue;
    }

    const blockQuote = trimmed.match(/^bq\.\s+(.*)$/);
    if (blockQuote) {
      closeLists();
      out.push(`<blockquote data-line="${i}">${renderInline(blockQuote[1])}</blockquote>`);
      continue;
    }

    const ulMatch = rawLine.match(/^\s*\*\s+(.*)$/);
    if (ulMatch) {
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        ulLine = i;
        out.push(`<ul data-line="${ulLine}">`);
        inUl = true;
      }
      out.push(`<li>${renderInline(ulMatch[1].trim())}</li>`);
      continue;
    }

    const olMatch = rawLine.match(/^\s*#\s+(.*)$/);
    if (olMatch) {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        olLine = i;
        out.push(`<ol data-line="${olLine}">`);
        inOl = true;
      }
      out.push(`<li>${renderInline(olMatch[1].trim())}</li>`);
      continue;
    }

    closeLists();
    out.push(`<p data-line="${i}">${renderInline(trimmed)}</p>`);
  }

  flushTable();
  closeLists();

  if (inCodeBlock) {
    out.push("</code></pre>");
  }

  return out.join("\n");
}