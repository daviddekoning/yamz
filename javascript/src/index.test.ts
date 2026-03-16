import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import JSZip from 'jszip';
import { bundle } from './index';

describe('YAMZ Bundler', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yamz-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('bundle simple markdown file', async () => {
        const mdFile = path.join(tmpDir, 'test.md');
        fs.writeFileSync(mdFile, '# Hello\n[link](other.md)');

        const otherFile = path.join(tmpDir, 'other.md');
        fs.writeFileSync(otherFile, 'Other content');

        const originalCwd = process.cwd();
        process.chdir(tmpDir);
        try {
            await bundle('test.md');
        } finally {
            process.chdir(originalCwd);
        }

        const yamzFile = path.join(tmpDir, 'test.mz');
        expect(fs.existsSync(yamzFile)).toBe(true);

        const zipData = fs.readFileSync(yamzFile);
        const zip = await JSZip.loadAsync(zipData);

        expect(zip.file('root.txt')).toBeDefined();
        expect(zip.file('test.md')).toBeDefined();
        expect(zip.file('other.md')).toBeDefined();

        const rootContent = await zip.file('root.txt')!.async('string');
        expect(rootContent.trim()).toBe('test.md');
    });

    test('bundle with images in subdirectories', async () => {
        const mdFile = path.join(tmpDir, 'test.md');
        fs.writeFileSync(mdFile, '![Image](img/pic.png)');

        const imgDir = path.join(tmpDir, 'img');
        fs.mkdirSync(imgDir);
        const picFile = path.join(imgDir, 'pic.png');
        fs.writeFileSync(picFile, 'fake png data');

        const originalCwd = process.cwd();
        process.chdir(tmpDir);
        try {
            await bundle('test.md');
        } finally {
            process.chdir(originalCwd);
        }

        const yamzFile = path.join(tmpDir, 'test.mz');
        expect(fs.existsSync(yamzFile)).toBe(true);

        const zipData = fs.readFileSync(yamzFile);
        const zip = await JSZip.loadAsync(zipData);

        expect(zip.file('img/pic.png')).toBeDefined();

        const content = await zip.file('test.md')!.async('string');
        expect(content).toContain('![Image](img/pic.png)');
    });

    test('bundle with assets outside base directory', async () => {
        const projectDir = path.join(tmpDir, 'project');
        fs.mkdirSync(projectDir);
        const srcDir = path.join(projectDir, 'src');
        fs.mkdirSync(srcDir);
        const assetsDir = path.join(projectDir, 'assets');
        fs.mkdirSync(assetsDir);

        const mainMd = path.join(srcDir, 'main.md');
        fs.writeFileSync(mainMd, '![Alt](../assets/img.png)');

        const imgFile = path.join(assetsDir, 'img.png');
        fs.writeFileSync(imgFile, 'data');

        const originalCwd = process.cwd();
        process.chdir(srcDir);
        try {
            await bundle('main.md');
        } finally {
            process.chdir(originalCwd);
        }

        const yamzFile = path.join(srcDir, 'main.mz');
        expect(fs.existsSync(yamzFile)).toBe(true);

        const zipData = fs.readFileSync(yamzFile);
        const zip = await JSZip.loadAsync(zipData);

        expect(zip.file('main.md')).toBeDefined();
        expect(zip.file('img.png')).toBeDefined();

        const content = await zip.file('main.md')!.async('string');
        expect(content).toContain('![Alt](img.png)');
    });
});
