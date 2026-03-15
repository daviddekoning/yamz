# YAMZ: Yet Another Markdown Zip Format Specification

## Overview
YAMZ is a format for packaging a markdown file along with all its referenced media and dependencies into a single, portable archive.

## File Format
A YAMZ file is a standard ZIP archive. It should typically use the `.yamz` extension.

## Archive Structure
1. **root.txt**: A required text file at the root of the ZIP archive. It must contain a single line of text representing the relative path to the primary markdown file within the archive.
2. **Markdown File**: The file pointed to by `root.txt`.
3. **Assets**: All media (images, videos, etc.) and other markdown files referenced by the primary markdown file (or its dependencies) must be included within the archive.

## References and Links
- All references within the markdown files must be relative paths that resolve correctly within the unpacked archive.
- There are no constraints on the internal directory structure of the archive, as long as all references are preserved.

## Example
A YAMZ archive might look like this:
```
/root.txt (contains "content/index.md")
/content/index.md
/content/images/photo.jpg
/other.md
```
In this example, `index.md` might contain `![Photo](images/photo.jpg)` and `[Other](.. /other.md)`.
