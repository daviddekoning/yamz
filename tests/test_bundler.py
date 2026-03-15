import os
import zipfile
import pytest
from pathlib import Path
from yamz.main import bundle

def test_bundle_simple(tmp_path):
    # Create a simple markdown file
    md_file = tmp_path / "test.md"
    md_file.write_text("# Hello\n[link](other.md)", encoding='utf-8')

    other_file = tmp_path / "other.md"
    other_file.write_text("Other content", encoding='utf-8')

    # Run bundle
    os.chdir(tmp_path)
    bundle("test.md")

    yamz_file = tmp_path / "test.yamz"
    assert yamz_file.exists()

    with zipfile.ZipFile(yamz_file, 'r') as zipf:
        namelist = zipf.namelist()
        assert "root.txt" in namelist
        assert "test.md" in namelist
        assert "other.md" in namelist

        with zipf.open("root.txt") as f:
            assert f.read().decode('utf-8').strip() == "test.md"

def test_bundle_with_images(tmp_path):
    # Create md with images
    md_file = tmp_path / "test.md"
    md_file.write_text("![Image](img/pic.png)", encoding='utf-8')

    img_dir = tmp_path / "img"
    img_dir.mkdir()
    pic_file = img_dir / "pic.png"
    pic_file.write_bytes(b"fake png data")

    os.chdir(tmp_path)
    bundle("test.md")

    yamz_file = tmp_path / "test.yamz"
    assert yamz_file.exists()

    with zipfile.ZipFile(yamz_file, 'r') as zipf:
        namelist = zipf.namelist()
        assert "img/pic.png" in namelist

        # Check if content was remapped correctly (it should stay same here as it is under base_dir)
        content = zipf.read("test.md").decode('utf-8')
        assert "![Image](img/pic.png)" in content

def test_bundle_outside_base(tmp_path):
    # Setup:
    # project/
    #   src/
    #     main.md (links to ../assets/img.png)
    #   assets/
    #     img.png

    project = tmp_path / "project"
    project.mkdir()
    src = project / "src"
    src.mkdir()
    assets = project / "assets"
    assets.mkdir()

    main_md = src / "main.md"
    main_md.write_text("![Alt](../assets/img.png)", encoding='utf-8')

    img_file = assets / "img.png"
    img_file.write_bytes(b"data")

    os.chdir(src)
    bundle("main.md")

    yamz_file = src / "main.yamz"
    assert yamz_file.exists()

    with zipfile.ZipFile(yamz_file, 'r') as zipf:
        namelist = zipf.namelist()
        assert "main.md" in namelist
        assert "img.png" in namelist

        # main.md should be updated to point to img.png directly if it was moved to root
        content = zipf.read("main.md").decode('utf-8')
        assert "![Alt](img.png)" in content
