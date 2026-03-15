import os
import sys
import zipfile
import re
from pathlib import Path

# More robust regex to match markdown links and images
# Group 1: optional !
# Group 2: link text
# Group 3: url
# Group 4: optional title
MD_LINK_RE = re.compile(r'(!?)\[(.*?)\]\(\s*(\S+?)(?:\s+["\'](.*?)["\'])?\s*\)')

def get_references(md_content):
    # Returns list of (full_match, is_image, text, url, title)
    links = []
    for match in MD_LINK_RE.finditer(md_content):
        links.append({
            'full': match.group(0),
            'is_image': bool(match.group(1)),
            'text': match.group(2),
            'url': match.group(3),
            'title': match.group(4)
        })
    return links

def bundle(markdown_file):
    md_path = Path(markdown_file).resolve()
    if not md_path.exists():
        print(f"Error: {markdown_file} does not exist")
        sys.exit(1)

    base_dir = md_path.parent
    yamz_name = md_path.stem + ".mz"

    # Map of absolute path -> path in archive
    abs_to_zip = {
        md_path: md_path.name
    }

    # Files content (if modified)
    zip_contents = {}

    to_process = [md_path]
    processed = set()

    while to_process:
        current_file = to_process.pop(0)
        if current_file in processed:
            continue
        processed.add(current_file)

        if current_file.suffix.lower() == '.md':
            with open(current_file, 'r', encoding='utf-8') as f:
                content = f.read()

            refs = get_references(content)
            modified_content = content

            for ref in refs:
                url = ref['url']
                # Ignore external links
                if url.startswith(('http://', 'https://', 'mailto:', '#')):
                    continue

                # Resolve path
                ref_path = (current_file.parent / url).resolve()
                if ref_path.exists() and ref_path.is_file():
                    if ref_path not in abs_to_zip:
                        try:
                            # Try to keep relative structure if under base_dir
                            rel_path = ref_path.relative_to(base_dir)
                            abs_to_zip[ref_path] = str(rel_path)
                        except ValueError:
                            # Outside base_dir, put in root or keep name
                            abs_to_zip[ref_path] = ref_path.name

                        if ref_path.suffix.lower() == '.md':
                            to_process.append(ref_path)

                    # Update link in markdown if necessary
                    # The new relative path in the zip should be relative to the current file's zip path
                    current_zip_path = Path(abs_to_zip[current_file])
                    ref_zip_path = Path(abs_to_zip[ref_path])

                    try:
                        # Compute relative path between files in the zip
                        new_rel_url = os.path.relpath(ref_zip_path, current_zip_path.parent)

                        # Replace in content. Use a safe way to replace only this specific instance if possible.
                        # Simple replacement might be too aggressive, but let's try.
                        old_ref = ref['full']
                        # Reconstruct the link with new url
                        prefix = "!" if ref['is_image'] else ""
                        title_part = f' "{ref["title"]}"' if ref['title'] else ""
                        new_ref = f'{prefix}[{ref["text"]}]({new_rel_url}{title_part})'

                        if old_ref != new_ref:
                            modified_content = modified_content.replace(old_ref, new_ref)

                    except Exception as e:
                        print(f"Warning: could not remap link {url}: {e}")

            zip_contents[abs_to_zip[current_file]] = modified_content

    with zipfile.ZipFile(yamz_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Create root.txt
        zipf.writestr('root.txt', abs_to_zip[md_path])

        # Add all files
        for abs_path, arc_path in abs_to_zip.items():
            if arc_path in zip_contents:
                zipf.writestr(arc_path, zip_contents[arc_path])
            else:
                zipf.write(abs_path, arc_path)

    print(f"Created {yamz_name}")

def main():
    if len(sys.argv) < 2:
        print("Usage: yamz <markdown-file>")
        sys.exit(1)

    bundle(sys.argv[1])

if __name__ == "__main__":
    main()
