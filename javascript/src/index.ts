import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

// Group 1: optional !
// Group 2: link text
// Group 3: url
// Group 4: optional title
const MD_LINK_RE = /(!?)\[(.*?)\]\(\s*(\S+?)(?:\s+["'](.*?)["'])?\s*\)/g;

export interface Reference {
    full: string;
    isImage: boolean;
    text: string;
    url: string;
    title?: string;
}

export function getReferences(mdContent: string): Reference[] {
    const links: Reference[] = [];
    let match;
    while ((match = MD_LINK_RE.exec(mdContent)) !== null) {
        links.push({
            full: match[0],
            isImage: Boolean(match[1]),
            text: match[2],
            url: match[3],
            title: match[4]
        });
    }
    return links;
}

export async function bundle(markdownFile: string): Promise<void> {
    const mdPath = path.resolve(markdownFile);
    if (!fs.existsSync(mdPath)) {
        throw new Error(`Error: ${markdownFile} does not exist`);
    }

    const baseDir = path.dirname(mdPath);
    const yamzName = path.parse(mdPath).name + ".mz";

    // Map of absolute path -> path in archive
    const absToZip: Record<string, string> = {
        [mdPath]: path.basename(mdPath)
    };

    // Files content (if modified)
    const zipContents: Record<string, string> = {};

    const toProcess: string[] = [mdPath];
    const processed = new Set<string>();

    while (toProcess.length > 0) {
        const currentFile = toProcess.shift()!;
        if (processed.has(currentFile)) {
            continue;
        }
        processed.add(currentFile);

        if (path.extname(currentFile).toLowerCase() === '.md') {
            let content = fs.readFileSync(currentFile, 'utf-8');
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
                    if (!(refPath in absToZip)) {
                        try {
                            // Try to keep relative structure if under baseDir
                            const relPath = path.relative(baseDir, refPath);
                            if (relPath.startsWith('..')) {
                                // Outside baseDir, put in root or keep name
                                absToZip[refPath] = path.basename(refPath);
                            } else {
                                absToZip[refPath] = relPath;
                            }
                        } catch (e) {
                            absToZip[refPath] = path.basename(refPath);
                        }

                        if (path.extname(refPath).toLowerCase() === '.md') {
                            toProcess.push(refPath);
                        }
                    }

                    // Update link in markdown if necessary
                    const currentZipPath = absToZip[currentFile];
                    const refZipPath = absToZip[refPath];

                    try {
                        // Compute relative path between files in the zip
                        const newRelUrl = path.relative(path.dirname(currentZipPath), refZipPath);

                        // Reconstruct the link with new url
                        const prefix = ref.isImage ? "!" : "";
                        const titlePart = ref.title ? ` "${ref.title}"` : "";
                        const newRef = `${prefix}[${ref.text}](${newRelUrl}${titlePart})`;

                        if (ref.full !== newRef) {
                            // Simple replacement - same as Python version
                            modifiedContent = modifiedContent.split(ref.full).join(newRef);
                        }
                    } catch (e) {
                        console.warn(`Warning: could not remap link ${url}: ${e}`);
                    }
                }
            }
            zipContents[absToZip[currentFile]] = modifiedContent;
        }
    }

    const zip = new JSZip();
    // Create root.txt
    zip.file('root.txt', absToZip[mdPath]);

    // Add all files
    for (const [absPath, arcPath] of Object.entries(absToZip)) {
        if (arcPath in zipContents) {
            zip.file(arcPath, zipContents[arcPath]);
        } else {
            zip.file(arcPath, fs.readFileSync(absPath));
        }
    }

    const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.writeFileSync(yamzName, content);

    console.log(`Created ${yamzName}`);
}
