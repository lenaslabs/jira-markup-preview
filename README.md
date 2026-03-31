# Jira Markup Preview

A Visual Studio Code extension that provides a live preview for Jira wiki / markup files.

## Features

- Live preview for Jira markup
- Preview opens beside the editor
- Supports headings, lists, quotes, links, tables, and code blocks
- Editor-to-preview scroll sync
- Works with `.jira` and `.wiki` files

## Supported syntax

Current (minimal) support includes:

- Headings like `h1.`, `h2.`
- Bold: `*text*`
- Italic: `_text_`
- Inline code: `{{code}}`
- Code blocks: `{code}` / `{code:ts}`
- Quotes: `bq.`
- Links: `[Text|https://example.com]`
- Bullet lists: `*`
- Ordered lists: `#`
- Tables with `||` and `|`

## Usage

1. Open a `.jira` or `.wiki` file in VS Code
2. Run the command `Jira Markup: Open Preview`
3. The preview opens beside the editor

## Development
```
npm install
npm run compile
```

Press `F5` in VS Code to start an Extension Development Host.

## Packaging

To create a VSIX package:
```
vsce package
```