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
                            modifiedContent = modifiedContent.split(ref.full).join(newRef);
                        }
                    } catch (e) {
                        console.warn(`Warning: could not remap link ${url}: ${e}`);
                    }
                }
            }
            zipContents.set(absToZip.get(currentFile)!, modifiedContent);
        }
    }

    const zip = new JSZip();
    // Create root.txt
    zip.file('root.txt', absToZip.get(mdPath)!);

    // Add all files
    for (const [absPath, arcPath] of absToZip.entries()) {
        if (zipContents.has(arcPath)) {
            zip.file(arcPath, zipContents.get(arcPath)!);
        } else {
            zip.file(arcPath, fs.readFileSync(absPath));
        }
    }

    const zipContent = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(yamzName, zipContent);
    console.log(`Created ${yamzName}`);
}

export function main() {
    yargs(hideBin(process.argv))
        .usage('Usage: yamz <markdown-file>')
        .command('$0 <markdownFile>', 'Bundle markdown file into .mz archive', (y) => {
            return y.positional('markdownFile', {
                describe: 'The entry markdown file',
                type: 'string'
            });
        }, (argv) => {
            if (argv.markdownFile) {
                bundle(argv.markdownFile).catch(err => {
                    console.error(`Error: ${err.message}`);
                    process.exit(1);
                });
            }
        })
        .help()
        .argv;
}

if (require.main === module) {
    main();
}
