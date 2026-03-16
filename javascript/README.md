# YAMZ (TypeScript)

Yet Another Markdown Zip bundler — package a markdown file and all its referenced media into a single portable `.mz` archive.

This is the TypeScript implementation of the YAMZ format.

## Installation

```
npm install -g yamz
```

## Usage

```
yamz my-document.md
```

This creates `my-document.mz` containing the markdown file, all referenced images, linked markdown files, and a `root.txt` entry point.

## Format

A `.mz` file is a standard ZIP archive containing:

- **root.txt** — a single line with the relative path to the primary markdown file
- **Markdown files** — the main document and any linked markdown files
- **Assets** — all referenced images, videos, and other media

All internal references use relative paths that resolve correctly within the archive.

## License

MIT
