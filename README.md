# Jira Markup Preview

A Visual Studio Code extension that provides a live preview for Jira wiki / markup files.

## Features

- Live preview for Jira markup
- Preview opens beside the editor
- Supports headings, nested lists, quotes, links, tables, code blocks, color markup, and more
- Editor-to-preview scroll sync
- Better preview stability when switching between files
- Improved word wrap behavior while editing with the preview open
- Works with `.jira` and `.wiki` files

## Supported syntax

Supported syntax includes:

- Headings like `h1.`, `h2.`
- Bold: `*text*`
- Italic: `_text_`
- Escaped underscores like `\_`
- Inline code: `{{code}}`
- Code blocks: `{code}` / `{code:ts}`
- Quotes: `bq.`
- Links: `[Text|https://example.com]`
- Bullet lists: `*`, `**`, `***`
- Ordered lists: `#`, `##`, `###`
- Mixed nested lists such as `#*` and `*#`
- Hierarchical numbering for ordered sub-lists
- Tables with `||` and `|`
- Horizontal rules with `-----`
- `--` and `---` for typographic dashes
- Explicit line breaks with `\\`
- Color markup with `{color:red}...{color}`
- Blank lines as paragraph breaks

## Usage

1. Open a `.jira` or `.wiki` file in VS Code
2. Run the command `Jira Markup: Open Preview`
3. The preview opens beside the editor

---

## Development

```bash
npm install
npm run compile
```

Press `F5` in VS Code to start an Extension Development Host.

## Packaging

Install `vsce` first:

```bash
npm install -g @vscode/vsce
```

Then create a VSIX package:

```bash
vsce package
```

This will generate a file similar to `jira-markup-preview-0.2.0.vsix`.
