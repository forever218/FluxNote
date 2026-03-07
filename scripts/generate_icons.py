"""
图标生成脚本
从源 SVG 程序化生成各尺寸的 PWA 图标（标准 + maskable）

使用方法:
    python scripts/generate_icons.py

需要安装: pip install Pillow
"""

import os
import sys
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("错误: 需要安装 Pillow")
    print("请运行: pip install Pillow")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'static', 'img', 'icons')

STANDARD_SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]
MASKABLE_SIZES = [192, 512]
MASKABLE_PADDING_RATIO = 0.1

# 与 icon.svg 一致的配色
BG_COLOR_TOP = (59, 130, 246)       # #3B82F6 Blue-500
BG_COLOR_BOTTOM = (29, 78, 216)     # #1D4ED8 Blue-700
BLOCK_COLOR = (59, 130, 246)        # #3B82F6


def draw_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    r = min(radius, (x1 - x0) // 2, (y1 - y0) // 2)
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    draw.pieslice([x0, y0, x0 + 2*r, y0 + 2*r], 180, 270, fill=fill)
    draw.pieslice([x1 - 2*r, y0, x1, y0 + 2*r], 270, 360, fill=fill)
    draw.pieslice([x0, y1 - 2*r, x0 + 2*r, y1], 90, 180, fill=fill)
    draw.pieslice([x1 - 2*r, y1 - 2*r, x1, y1], 0, 90, fill=fill)


def create_gradient_bg(size):
    """创建蓝色渐变圆角矩形背景"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    radius = int(size * 112 / 512)

    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    draw_rounded_rect(mask_draw, (0, 0, size - 1, size - 1), radius, 255)

    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(BG_COLOR_TOP[0] * (1 - t) + BG_COLOR_BOTTOM[0] * t)
        g = int(BG_COLOR_TOP[1] * (1 - t) + BG_COLOR_BOTTOM[1] * t)
        b = int(BG_COLOR_TOP[2] * (1 - t) + BG_COLOR_BOTTOM[2] * t)
        for x in range(size):
            if mask.getpixel((x, y)) > 0:
                img.putpixel((x, y), (r, g, b, 255))
    return img


def draw_note_shape(draw, size):
    """在画布上绘制笔记形状（白色纸张+折角+蓝色内容块）"""
    s = size / 512.0

    # 纸张主体（白色圆角矩形 + 右上折角缺口）
    paper_left = int(140 * s)
    paper_top = int(120 * s)
    paper_right = int(380 * s)
    paper_bottom = int(394 * s)
    fold_x = int(310 * s)
    fold_y = int(190 * s)
    corner_r = int(24 * s)

    draw_rounded_rect(draw, (paper_left, paper_top, paper_right, paper_bottom), corner_r, (255, 255, 255, 255))
    # 折角三角区域用背景色覆盖（模拟缺口），然后画折页
    draw.polygon([
        (fold_x, paper_top),
        (paper_right, paper_top),
        (paper_right, fold_y),
        (fold_x, paper_top)
    ], fill=(0, 0, 0, 0))

    # 折页（浅灰渐变效果简化为纯色）
    fold_color = (226, 232, 240, 255)  # #E2E8F0
    draw.polygon([
        (fold_x, paper_top),
        (paper_right, fold_y),
        (fold_x, fold_y),
    ], fill=fold_color)

    # 模块化内容块（蓝色圆角条）
    blocks = [
        (196, 196, 76, 28, 1.0),
        (284, 196, 56, 28, 0.25),
        (196, 244, 48, 28, 0.25),
        (256, 244, 88, 28, 1.0),
        (196, 292, 112, 28, 1.0),
    ]
    for bx, by, bw, bh, opacity in blocks:
        x0 = int(bx * s)
        y0 = int(by * s)
        x1 = int((bx + bw) * s)
        y1 = int((by + bh) * s)
        br = int(14 * s)
        alpha = int(255 * opacity)
        color = (*BLOCK_COLOR, alpha)
        draw_rounded_rect(draw, (x0, y0, x1, y1), br, color)


def generate_icon(size):
    """生成标准图标"""
    base = create_gradient_bg(size)
    draw = ImageDraw.Draw(base, 'RGBA')
    draw_note_shape(draw, size)
    return base


def generate_maskable_icon(size):
    """生成 maskable 图标：标准图标缩放到安全区域(80%)"""
    inner = generate_icon(size)
    padding = int(size * MASKABLE_PADDING_RATIO)
    inner_size = size - 2 * padding

    bg_color = (
        (BG_COLOR_TOP[0] + BG_COLOR_BOTTOM[0]) // 2,
        (BG_COLOR_TOP[1] + BG_COLOR_BOTTOM[1]) // 2,
        (BG_COLOR_TOP[2] + BG_COLOR_BOTTOM[2]) // 2,
        255
    )
    canvas = Image.new('RGBA', (size, size), bg_color)
    scaled = inner.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    canvas.paste(scaled, (padding, padding), scaled)
    return canvas


def main():
    print("=" * 50)
    print("  流光笔记 PWA 图标生成器")
    print("=" * 50)

    os.makedirs(ICONS_DIR, exist_ok=True)

    # 1. 标准图标
    print("\n── 标准图标 ──")
    for size in STANDARD_SIZES:
        icon = generate_icon(size)
        path = os.path.join(ICONS_DIR, f'icon-{size}.png')
        icon.save(path, 'PNG', optimize=True)
        print(f"  ✓ icon-{size}.png ({size}x{size})")

    # 2. Maskable 图标
    print("\n── Maskable 图标 ──")
    for size in MASKABLE_SIZES:
        icon = generate_maskable_icon(size)
        path = os.path.join(ICONS_DIR, f'icon-maskable-{size}.png')
        icon.save(path, 'PNG', optimize=True)
        print(f"  ✓ icon-maskable-{size}.png ({size}x{size})")

    # 3. Apple Touch Icon (180x180, 白色不透明背景)
    print("\n── Apple Touch Icon ──")
    apple = generate_icon(180)
    apple_rgb = Image.new('RGB', (180, 180), (255, 255, 255))
    apple_rgb.paste(apple, (0, 0), apple)
    apple_path = os.path.join(ICONS_DIR, 'apple-touch-icon.png')
    apple_rgb.save(apple_path, 'PNG', optimize=True)
    print(f"  ✓ apple-touch-icon.png (180x180)")

    total = len(STANDARD_SIZES) + len(MASKABLE_SIZES) + 1
    print(f"\n所有图标生成完成! 共 {total} 个文件")
    print(f"输出目录: {ICONS_DIR}\n")


if __name__ == '__main__':
    main()
