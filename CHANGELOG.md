# Changelog

## 0.2.0

### Added

- Added support for escaped underscores so `\_` is rendered literally without triggering italic formatting.
- Added support for nested mixed lists across multiple levels, including combinations such as `**`, `##`, `#*`, and `*#`.
- Added hierarchical numbering for nested ordered lists so sub-items render as values like `2.1.` instead of restarting at `1.`.
- Added support for horizontal rules with `-----`.
- Added support for `--` and `---` as en dash and em dash replacements.
- Added support for explicit line breaks using `\\`.
- Added support for `{color:...}...{color}` markup in both inline and multi-line usage.

### Changed

- Improved paragraph handling so blank lines create separate paragraphs in the preview.
- Improved code block rendering to remove the extra empty line at the top of previewed blocks.
- Refined code block styling so blocks no longer look like selected text.
- Updated preview behavior so the panel only switches context when another `.jira` or `.wiki` document becomes active.
- Improved editor behavior when the preview is open by enabling word wrap for supported Jira/Wiki documents when needed.

### Fixed

- Fixed preview rendering for escaped markup characters in inline content.
- Fixed several list rendering issues in deeply nested structures.
- Fixed compile compatibility with the current TypeScript target configuration.
