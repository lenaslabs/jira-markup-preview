import * as vscode from "vscode";
import { JiraPreviewManager } from "./preview";

export function activate(context: vscode.ExtensionContext) {
  const preview = new JiraPreviewManager(context);

  context.subscriptions.push(preview);

  context.subscriptions.push(
    vscode.commands.registerCommand("jiraMarkupPreview.openPreview", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor found.");
        return;
      }

      preview.showPreview(editor.document);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      preview.handleDocumentChange(event);
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      preview.handleEditorChange(editor);
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
      preview.syncScrollFromEditor(event.textEditor);
    })
  );
}

export function deactivate() {}