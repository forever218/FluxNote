"""
图标生成脚本
通过本机浏览器的无头截图能力，将源 SVG 真实渲染为各尺寸的 PWA 图标。

使用方法:
    python scripts/generate_icons.py

依赖:
    - Pillow
    - 本机已安装 Edge 或 Chrome
"""

import os
import sys
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
STATIC_DIR = PROJECT_ROOT / 'app' / 'static'
ICONS_DIR = PROJECT_ROOT / 'app' / 'static' / 'img' / 'icons'
SVG_PATH = ICONS_DIR / 'icon.svg'
FAVICON_PATH = STATIC_DIR / 'favicon.ico'

STANDARD_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]
MASKABLE_SIZES = [192, 512]
ICO_SIZES = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64)]
MASKABLE_PADDING_RATIO = 0.1
MASTER_RENDER_SIZE = 4096
MASTER_VIEWPORT_PADDING = 256

BROWSER_PATHS = [
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Users\Soulxyz\AppData\Local\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Users\Soulxyz\AppData\Local\Google\Chrome\Application\chrome.exe"),
]


def find_browser():
    """查找可用于无头截图的浏览器。"""
    for path in BROWSER_PATHS:
        if path.exists():
            return path
    raise RuntimeError("未找到 Edge 或 Chrome，无法进行 SVG 真实渲染。")


def build_wrapper_html(render_size, viewport_size):
    """创建一个透明背景页面，在更大画布中居中渲染 SVG。"""
    svg_uri = SVG_PATH.resolve().as_uri()
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body {{
      margin: 0;
      width: {viewport_size}px;
      height: {viewport_size}px;
      overflow: hidden;
      background: transparent;
    }}
    body {{
      display: grid;
      place-items: center;
    }}
    img {{
      display: block;
      width: {render_size}px;
      height: {render_size}px;
      image-rendering: auto;
    }}
  </style>
</head>
<body>
  <img src="{svg_uri}" alt="FluxNote icon" />
</body>
</html>
"""


def render_master_icon(render_size, browser_path):
    """使用浏览器在更大画布上渲染 SVG，再中心裁切出母版。"""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        html_path = tmp_path / "render-icon.html"
        viewport_size = render_size + MASTER_VIEWPORT_PADDING * 2
        raw_png_path = tmp_path / f"icon-raw-{viewport_size}.png"
        html_path.write_text(
            build_wrapper_html(render_size, viewport_size),
            encoding="utf-8",
        )

        command = [
            str(browser_path),
            "--headless=new",
            "--disable-gpu",
            "--hide-scrollbars",
            "--no-first-run",
            "--disable-default-apps",
            "--force-device-scale-factor=1",
            "--default-background-color=00000000",
            f"--window-size={viewport_size},{viewport_size}",
            f"--screenshot={raw_png_path}",
            html_path.resolve().as_uri(),
        ]
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if completed.returncode != 0 or not raw_png_path.exists():
            raise RuntimeError(
                "浏览器截图失败。\n"
                f"stdout:\n{completed.stdout}\n"
                f"stderr:\n{completed.stderr}"
            )
        raw_image = Image.open(raw_png_path).convert("RGBA")
        left = MASTER_VIEWPORT_PADDING
        top = MASTER_VIEWPORT_PADDING
        right = left + render_size
        bottom = top + render_size
        return raw_image.crop((left, top, right, bottom))


def resize_icon(master_icon, size):
    """从同一张高分辨率母版统一缩放出目标尺寸。"""
    return master_icon.resize((size, size), Image.Resampling.LANCZOS)


def generate_maskable(icon, size):
    """基于标准图标生成 maskable 版本。"""
    padding = int(size * MASKABLE_PADDING_RATIO)
    inner_size = size - 2 * padding

    bg_color = (10, 168, 117, 255)
    canvas = Image.new('RGBA', (size, size), bg_color)
    scaled = icon.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    canvas.paste(scaled, (padding, padding), scaled)
    return canvas


def generate_favicon(master_icon):
    """从高清母版导出多尺寸 favicon.ico。"""
    FAVICON_PATH.parent.mkdir(parents=True, exist_ok=True)
    master_icon.save(
        FAVICON_PATH,
        format='ICO',
        sizes=ICO_SIZES,
    )


def main():
    print("=" * 50)
    print("  流光笔记 PWA 图标生成器 (SVG → PNG)")
    print("=" * 50)

    if not SVG_PATH.exists():
        print(f"\n错误: 找不到源 SVG 文件: {SVG_PATH}")
        sys.exit(1)

    browser_path = find_browser()
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"\n源文件: {SVG_PATH}")
    print(f"浏览器: {browser_path}")
    print(f"母版尺寸: {MASTER_RENDER_SIZE}x{MASTER_RENDER_SIZE}")

    master_icon = render_master_icon(MASTER_RENDER_SIZE, browser_path)

    print("\n── 标准图标 ──")
    icons_cache = {}
    for size in STANDARD_SIZES:
        icon = resize_icon(master_icon, size)
        icons_cache[size] = icon
        path = ICONS_DIR / f'icon-{size}.png'
        icon.save(path, 'PNG', optimize=True)
        print(f"  ✓ icon-{size}.png ({size}x{size})")

    print("\n── Maskable 图标 ──")
    for size in MASKABLE_SIZES:
        if size in icons_cache:
            base = icons_cache[size]
        else:
            base = resize_icon(master_icon, size)
        maskable = generate_maskable(base, size)
        path = ICONS_DIR / f'icon-maskable-{size}.png'
        maskable.save(path, 'PNG', optimize=True)
        print(f"  ✓ icon-maskable-{size}.png ({size}x{size})")

    print("\n── Apple Touch Icon ──")
    if 180 in icons_cache:
        apple_rgba = icons_cache[180]
    else:
        apple_rgba = resize_icon(master_icon, 180)
    apple_rgb = Image.new('RGB', (180, 180), (255, 255, 255))
    apple_rgb.paste(apple_rgba, (0, 0), apple_rgba)
    apple_path = ICONS_DIR / 'apple-touch-icon.png'
    apple_rgb.save(apple_path, 'PNG', optimize=True)
    print("  ✓ apple-touch-icon.png (180x180)")

    print("\n── Favicon ──")
    generate_favicon(master_icon)
    print("  ✓ favicon.ico (16/24/32/48/64)")

    total = len(STANDARD_SIZES) + len(MASKABLE_SIZES) + 2
    print(f"\n所有图标生成完成! 共 {total} 个文件")
    print(f"输出目录: {ICONS_DIR}\n")


if __name__ == '__main__':
    main()
