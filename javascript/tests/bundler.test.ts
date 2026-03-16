import { getReferences } from '../src/index';

describe('getReferences', () => {
    it('should extract simple markdown links', () => {
        const content = '[Link Text](path/to/file.md)';
        const refs = getReferences(content);
        expect(refs).toHaveLength(1);
        expect(refs[0]).toEqual({
            full: '[Link Text](path/to/file.md)',
            isImage: false,
            text: 'Link Text',
            url: 'path/to/file.md',
            title: undefined
        });
    });

    it('should extract image links', () => {
        const content = '![Alt Text](images/photo.png "A photo")';
        const refs = getReferences(content);
        expect(refs).toHaveLength(1);
        expect(refs[0]).toEqual({
            full: '![Alt Text](images/photo.png "A photo")',
            isImage: true,
            text: 'Alt Text',
            url: 'images/photo.png',
            title: 'A photo'
        });
    });

    it('should extract multiple links', () => {
        const content = `
# Header
[Link 1](file1.md)
Some text and ![Image 1](img1.png)
        `;
        const refs = getReferences(content);
        expect(refs).toHaveLength(2);
        expect(refs[0].text).toBe('Link 1');
        expect(refs[1].isImage).toBe(true);
    });

    it('should handle links with spaces and titles', () => {
        const content = '[Text](url "Title")';
        const refs = getReferences(content);
        expect(refs[0].url).toBe('url');
        expect(refs[0].title).toBe('Title');
    });
});
