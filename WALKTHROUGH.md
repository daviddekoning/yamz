# YAMZ TypeScript Bundler Walkthrough

*2026-03-16T21:07:11Z by Showboat dev*
<!-- showboat-id: 5827056b-eed7-4487-92cf-e418f7e212e7 -->

The TypeScript implementation of the YAMZ bundler is located in the `javascript/` directory. It uses `jszip` for creating ZIP archives and `yargs` for the CLI interface.

```bash
ls -F javascript/
```

```output
dist/
node_modules/
package-lock.json
package.json
src/
tsconfig.json
```

The `package.json` defines the dependencies and build scripts.

```bash
cat javascript/package.json
```

```output
{
  "name": "yamz",
  "version": "0.1.0",
  "description": "Yet Another Markdown Zip bundler",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "yamz": "dist/index.js"
  },
  "scripts": {
    "build": "rimraf dist && tsc",
    "test": "jest"
  },
  "dependencies": {
    "jszip": "^3.10.1",
    "yargs": "^17.7.2"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/node": "^25.5.0",
    "@types/yargs": "^17.0.35",
    "jest": "^30.3.0",
    "rimraf": "^6.1.3",
    "ts-jest": "^29.4.6",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.3"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": [
      "**/src/**/*.test.ts"
    ]
  }
}
```

The core logic resides in `javascript/src/index.ts`. It uses a regular expression to find markdown links and images, then recursively bundles them.

```bash
sed -n '1,60p' javascript/src/index.ts
```

```output
#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface MarkdownReference {
    full: string;
    isImage: boolean;
    text: string;
    url: string;
    title?: string;
}

// Group 1: optional !
// Group 2: link text
// Group 3: url
// Group 4: optional title
export const MD_LINK_RE = /(!?)\[(.*?)\]\(\s*(\S+?)(?:\s+["\'](.*?)["\'])?\s*\)/g;

export function getReferences(mdContent: string): MarkdownReference[] {
    const links: MarkdownReference[] = [];
    let match;
    // Reset lastIndex for global regex
    MD_LINK_RE.lastIndex = 0;
    while ((match = MD_LINK_RE.exec(mdContent)) !== null) {
        links.push({
            full: match[0],
            isImage: !!match[1],
            text: match[2] || '',
            url: match[3] || '',
            title: match[4]
        });
    }
    return links;
}

/**
 * Standardizes a path to use forward slashes for internal ZIP paths and URLs.
 */
function toForwardSlashes(p: string): string {
    return p.split(path.sep).join('/');
}

export async function bundle(markdownFile: string): Promise<void> {
    const mdPath = path.resolve(markdownFile);
    if (!fs.existsSync(mdPath)) {
        throw new Error(`${markdownFile} does not exist`);
    }

    const baseDir = path.dirname(mdPath);
    const yamzName = path.parse(mdPath).name + ".mz";

    // Map of absolute path -> path in archive
    const absToZip: Map<string, string> = new Map();
    absToZip.set(mdPath, path.basename(mdPath));

    // Files content (if modified)
    const zipContents: Map<string, string> = new Map();
```

The `bundle` function handles the BFS-based discovery and remapping of links to ensure they work within the ZIP archive.

```bash
sed -n '61,120p' javascript/src/index.ts
```

```output

    const toProcess: string[] = [mdPath];
    const processed: Set<string> = new Set();

    while (toProcess.length > 0) {
        const currentFile = toProcess.shift()!;
        if (processed.has(currentFile)) continue;
        processed.add(currentFile);

        if (path.extname(currentFile).toLowerCase() === '.md') {
            const content = fs.readFileSync(currentFile, 'utf-8');
            const refs = getReferences(content);
            let modifiedContent = content;

            for (const ref of refs) {
                const url = ref.url;
                // Ignore external links
                if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('#')) {
                    continue;
                }

                // Resolve path
                const refPath = path.resolve(path.dirname(currentFile), url);
                if (fs.existsSync(refPath) && fs.statSync(refPath).isFile()) {
                    if (!absToZip.has(refPath)) {
                        try {
                            let relPathInZip: string;
                            const relativeToBase = path.relative(baseDir, refPath);
                            // Check if refPath is under baseDir
                            if (!relativeToBase.startsWith('..') && !path.isAbsolute(relativeToBase)) {
                                relPathInZip = relativeToBase;
                            } else {
                                // Outside baseDir, put in root or keep name
                                relPathInZip = path.basename(refPath);
                            }

                            absToZip.set(refPath, toForwardSlashes(relPathInZip));

                            if (path.extname(refPath).toLowerCase() === '.md') {
                                toProcess.push(refPath);
                            }
                        } catch (err) {
                            console.warn(`Warning: could not determine ZIP path for ${url}: ${err}`);
                        }
                    }

                    // Update link in markdown if necessary
                    const currentZipPath = absToZip.get(currentFile)!;
                    const refZipPath = absToZip.get(refPath)!;

                    try {
                        // Compute relative path between files in the zip
                        let newRelUrl = path.relative(path.dirname(currentZipPath), refZipPath);
                        newRelUrl = toForwardSlashes(newRelUrl);

                        const prefix = ref.isImage ? "!" : "";
                        const titlePart = ref.title ? ` "${ref.title}"` : "";
                        const newRef = `${prefix}[${ref.text}](${newRelUrl}${titlePart})`;

                        if (ref.full !== newRef) {
```

First, we build the project to generate the executable.

```bash
cd javascript && npm run build
```

```output

> yamz@0.1.0 build
> rimraf dist && tsc

```

Now let's create a demo markdown file with an image.

```bash
mkdir -p demo/images && echo '# Demo YAMZ' > demo/index.md && echo '![Logo](images/logo.png)' >> demo/index.md && echo 'fake image' > demo/images/logo.png
```

```output
```

Run the bundler on the demo file.

```bash
node javascript/dist/index.js demo/index.md
```

```output
Created index.mz
```

Verify the output .mz file exists.

```bash
ls -l index.mz
```

```output
-rw-rw-r-- 1 jules jules 462 Mar 16 21:10 index.mz
```

We can inspect the contents of the zip file to see if root.txt and images are correctly placed.

```bash
unzip -l index.mz
```

```output
Archive:  index.mz
  Length      Date    Time    Name
---------  ---------- -----   ----
        8  2026-03-16 21:10   root.txt
       37  2026-03-16 21:10   index.md
        0  2026-03-16 21:10   images/
       11  2026-03-16 21:10   images/logo.png
---------                     -------
       56                     4 files
```
