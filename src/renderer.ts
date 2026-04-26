function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPlaceholder(prefix: string, index: number): string {
  return `@@${prefix}${index}@@`;
}

function replaceAllLiteral(input: string, search: string, replacement: string): string {
  return input.split(search).join(replacement);
}

function sanitizeColorValue(color: string): string | null {
  const normalized = color.trim();

  if (/^[a-zA-Z][a-zA-Z0-9-]*$/.test(normalized)) {
    return normalized;
  }

  if (/^#[0-9a-fA-F]{3,8}$/.test(normalized)) {
    return normalized;
  }

  if (/^(rgb|rgba|hsl|hsla)\([^()]+\)$/.test(normalized)) {
    return normalized;
  }

  return null;
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
  let normalized = text;
  const escapedTokens: string[] = [];
  const htmlTokens: string[] = [];

  normalized = normalized.replace(/\\\\/g, () => {
    const placeholder = createPlaceholder("HTML", htmlTokens.length);
    htmlTokens.push("<br />");
    return placeholder;
  });

  normalized = normalized.replace(/\\([\\_*])/g, (_match, value: string) => {
    const placeholder = createPlaceholder("ESC", escapedTokens.length);
    escapedTokens.push(escapeHtml(value));
    return placeholder;
  });

  normalized = normalized.replace(/\{\{([^{}]+)\}\}/g, (_match, code: string) => {
    const placeholder = createPlaceholder("HTML", htmlTokens.length);
    htmlTokens.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  normalized = normalized.replace(
    /\[([^|\]]+)\|([^\]]+)\]/g,
    (_match, label: string, href: string) => {
      const placeholder = createPlaceholder("HTML", htmlTokens.length);
      const safeHref = sanitizeUrl(href.trim());
      const safeLabel = escapeHtml(label.trim());

      if (!safeHref) {
        htmlTokens.push(safeLabel);
        return placeholder;
      }

      htmlTokens.push(
        `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`
      );
      return placeholder;
    }
  );

  normalized = normalized.replace(
    /\{color:([^}\n]+)\}([\s\S]*?)\{color\}/g,
    (_match, color: string, content: string) => {
      const placeholder = createPlaceholder("HTML", htmlTokens.length);
      const safeColor = sanitizeColorValue(color);

      if (!safeColor) {
        htmlTokens.push(renderInline(content));
        return placeholder;
      }

      htmlTokens.push(
        `<span style="color: ${escapeHtml(safeColor)}">${renderInline(content)}</span>`
      );
      return placeholder;
    }
  );

  let html = escapeHtml(normalized);

  html = html.replace(/---/g, "&mdash;");
  html = html.replace(/--/g, "&ndash;");
  html = html.replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>");
  html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  escapedTokens.forEach((token, index) => {
    html = replaceAllLiteral(html, createPlaceholder("ESC", index), token);
  });

  htmlTokens.forEach((token, index) => {
    html = replaceAllLiteral(html, createPlaceholder("HTML", index), token);
  });

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

  let codeBlockLines: string[] | undefined;
  let codeBlockLanguage = "";
  let codeBlockStartLine = 0;
  let colorBlockLines: string[] | undefined;
  let colorBlockValue = "";
  let colorBlockStartLine = 0;
  let tableRows: TableRow[] = [];
  const listStack: Array<{
    type: "ul" | "ol";
    itemOpen: boolean;
    orderedIndex: number;
  }> = [];
  let paragraphLines: string[] = [];
  let paragraphStartLine = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    out.push(
      `<p data-line="${paragraphStartLine}">${renderInline(paragraphLines.join(" "))}</p>`
    );
    paragraphLines = [];
  };

  const closeLists = () => {
    while (listStack.length > 0) {
      const current = listStack.pop();
      if (!current) {
        continue;
      }

      if (current.itemOpen) {
        out.push("</li>");
      }
      out.push(`</${current.type}>`);
    }
  };

  const flushCodeBlock = () => {
    if (!codeBlockLines) {
      return;
    }

    const classAttr = codeBlockLanguage ? ` class="language-${codeBlockLanguage}"` : "";
    out.push(
      `<pre data-line="${codeBlockStartLine}"><code${classAttr}>${escapeHtml(
        codeBlockLines.join("\n")
      )}</code></pre>`
    );

    codeBlockLines = undefined;
    codeBlockLanguage = "";
  };

  const flushColorBlock = () => {
    if (!colorBlockLines) {
      return;
    }

    const safeColor = sanitizeColorValue(colorBlockValue);
    const content = colorBlockLines.map((entry) => renderInline(entry)).join("<br />");

    if (safeColor) {
      out.push(
        `<p data-line="${colorBlockStartLine}"><span style="color: ${escapeHtml(
          safeColor
        )}">${content}</span></p>`
      );
    } else {
      out.push(`<p data-line="${colorBlockStartLine}">${content}</p>`);
    }

    colorBlockLines = undefined;
    colorBlockValue = "";
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
      flushParagraph();
      flushTable();
      closeLists();

      if (!codeBlockLines) {
        codeBlockStartLine = i;
        codeBlockLanguage = codeFence[1] ? escapeHtml(codeFence[1].trim()) : "";
        codeBlockLines = [];
      } else {
        flushCodeBlock();
      }
      continue;
    }

    if (codeBlockLines) {
      codeBlockLines.push(rawLine);
      continue;
    }

    const colorBlockStart = trimmed.match(/^\{color:([^}]+)\}$/);
    if (colorBlockStart) {
      flushParagraph();
      flushTable();
      closeLists();
      colorBlockStartLine = i;
      colorBlockValue = colorBlockStart[1];
      colorBlockLines = [];
      continue;
    }

    if (trimmed === "{color}" && colorBlockLines) {
      flushColorBlock();
      continue;
    }

    if (colorBlockLines) {
      colorBlockLines.push(rawLine.trimEnd());
      continue;
    }

    const tableRow = parseTableRow(trimmed, i);
    if (tableRow) {
      flushParagraph();
      closeLists();
      tableRows.push(tableRow);
      continue;
    }
    flushTable();

    if (!trimmed) {
      flushParagraph();
      closeLists();
      continue;
    }

    if (trimmed === "-----") {
      flushParagraph();
      closeLists();
      out.push(`<hr data-line="${i}" />`);
      continue;
    }

    const heading = trimmed.match(/^h([1-6])\.\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeLists();
      out.push(
        `<h${heading[1]} data-line="${i}">${renderInline(heading[2])}</h${heading[1]}>`
      );
      continue;
    }

    const blockQuote = trimmed.match(/^bq\.\s+(.*)$/);
    if (blockQuote) {
      flushParagraph();
      closeLists();
      out.push(`<blockquote data-line="${i}">${renderInline(blockQuote[1])}</blockquote>`);
      continue;
    }

    const listMatch = rawLine.match(/^\s*([*#]+)\s+(.*)$/);
    if (listMatch) {
      flushParagraph();

      const markerTypes = [...listMatch[1]].map((marker) =>
        marker === "*" ? "ul" : "ol"
      );
      const content = listMatch[2].trim();
      let commonDepth = 0;

      while (
        commonDepth < listStack.length &&
        commonDepth < markerTypes.length &&
        listStack[commonDepth].type === markerTypes[commonDepth]
      ) {
        commonDepth++;
      }

      while (listStack.length > commonDepth) {
        const current = listStack.pop();
        if (!current) {
          continue;
        }

        if (current.itemOpen) {
          out.push("</li>");
        }
        out.push(`</${current.type}>`);
      }

      if (markerTypes.length <= commonDepth && commonDepth > 0) {
        const parent = listStack[commonDepth - 1];
        if (parent.itemOpen) {
          out.push("</li>");
          parent.itemOpen = false;
        }
      }

      for (let depth = commonDepth; depth < markerTypes.length; depth++) {
        const type = markerTypes[depth];
        out.push(`<${type} data-line="${i}">`);
        listStack.push({ type, itemOpen: false, orderedIndex: 0 });
      }

      const currentList = listStack[listStack.length - 1];
      let itemHtml = renderInline(content);

      if (currentList.type === "ol") {
        currentList.orderedIndex += 1;
        const orderedPath = listStack
          .filter((entry) => entry.type === "ol")
          .map((entry) => entry.orderedIndex)
          .join(".");

        itemHtml =
          `<span class="list-marker">${orderedPath}.</span>` +
          `<span class="list-item-content">${itemHtml}</span>`;
      }

      out.push(`<li data-line="${i}">${itemHtml}`);
      currentList.itemOpen = true;
      continue;
    }

    closeLists();
    if (paragraphLines.length === 0) {
      paragraphStartLine = i;
    }
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushTable();
  closeLists();
  flushCodeBlock();
  flushColorBlock();

  return out.join("\n");
}
