import * as vscode from "vscode";
import { renderJiraMarkup } from "./renderer";

export class JiraPreviewManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private currentDocument: vscode.TextDocument | undefined;
  private renderTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public showPreview(document: vscode.TextDocument) {
    this.currentDocument = document;

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "jiraMarkupPreview",
        this.getTitle(document),
        vscode.ViewColumn.Beside,
        {
          enableFindWidget: true,
          retainContextWhenHidden: true,
          enableScripts: true
        }
      );

      this.panel.onDidDispose(() => {
        this.disposePanelState();
      }, null, this.context.subscriptions);
    }

    this.panel.title = this.getTitle(document);
    this.renderNow(document);
  }

  public handleDocumentChange(event: vscode.TextDocumentChangeEvent) {
    if (!this.panel || !this.currentDocument) {
      return;
    }

    if (event.document.uri.toString() !== this.currentDocument.uri.toString()) {
      return;
    }

    this.scheduleRender(event.document);
  }

  public handleEditorChange(editor: vscode.TextEditor | undefined) {
    if (!editor || !this.panel) {
      return;
    }

    this.currentDocument = editor.document;
    this.panel.title = this.getTitle(editor.document);
    this.scheduleRender(editor.document);
  }

  public syncScrollFromEditor(editor: vscode.TextEditor) {
    if (!this.panel || !this.currentDocument) {
      return;
    }

    if (editor.document.uri.toString() !== this.currentDocument.uri.toString()) {
      return;
    }

    const firstVisible = editor.visibleRanges[0];
    if (!firstVisible) {
      return;
    }

    const topLine = firstVisible.start.line;

    this.panel.webview.postMessage({
      command: "scrollToLine",
      line: topLine
    });
  }

  public dispose() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = undefined;
    }

    this.panel?.dispose();
  }

  private scheduleRender(document: vscode.TextDocument) {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }

    this.renderTimer = setTimeout(() => {
      this.renderNow(document);
    }, 120);
  }

  private renderNow(document: vscode.TextDocument) {
    if (!this.panel) {
      return;
    }

    const body = renderJiraMarkup(document.getText());
    this.panel.webview.html = this.getHtml(body, document, this.panel.webview);
  }

  private getTitle(document: vscode.TextDocument): string {
    return `Jira Preview: ${vscode.workspace.asRelativePath(document.uri, false)}`;
  }

  private disposePanelState() {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = undefined;
    }

    this.panel = undefined;
    this.currentDocument = undefined;
  }

  private getHtml(
    body: string,
    document: vscode.TextDocument,
    webview: vscode.Webview
  ): string {
    const title = escapeHtml(
      document.fileName.split(/[\\/]/).pop() ?? "Jira Preview"
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};"
  />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light dark;
    }

    html {
      scroll-behavior: auto;
    }

    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      padding: 24px;
      line-height: 1.6;
      max-width: 960px;
      margin: 0 auto;
      overflow-wrap: anywhere;
    }

    h1, h2, h3, h4, h5, h6 {
      line-height: 1.25;
      margin-top: 1.4em;
    }

    p, ul, ol, blockquote, table, pre {
      margin: 0.8em 0;
    }

    code, pre {
      font-family: var(--vscode-editor-font-family);
      font-size: 0.95em;
    }

    :not(pre) > code {
      background: var(--vscode-textCodeBlock-background);
      padding: 0.15em 0.35em;
      border-radius: 4px;
    }

    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
    }

    blockquote {
      border-left: 4px solid var(--vscode-textBlockQuote-border);
      margin-left: 0;
      padding-left: 16px;
      opacity: 0.95;
    }

    table {
      border-collapse: collapse;
      width: 100%;
    }

    th, td {
      border: 1px solid var(--vscode-panel-border);
      padding: 6px 10px;
      text-align: left;
      vertical-align: top;
    }

    thead th {
      background: var(--vscode-editor-inactiveSelectionBackground);
    }

    a {
      color: var(--vscode-textLink-foreground);
    }

    [data-line] {
      scroll-margin-top: 16px;
    }
  </style>
</head>
<body>
  ${body}
  <script nonce="${nonce}">
    window.addEventListener("message", (event) => {
      const message = event.data;

      if (message.command === "scrollToLine") {
        const target =
          document.querySelector('[data-line="' + message.line + '"]') ||
          findNearestLine(message.line);

        if (target) {
          target.scrollIntoView({ block: "start" });
        }
      }
    });

    function findNearestLine(line) {
      const nodes = Array.from(document.querySelectorAll("[data-line]"));
      let best = null;
      let bestValue = -1;

      for (const node of nodes) {
        const value = Number(node.getAttribute("data-line"));
        if (!Number.isNaN(value) && value <= line && value > bestValue) {
          best = node;
          bestValue = value;
        }
      }

      return best;
    }
  </script>
</body>
</html>`;
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNonce(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}