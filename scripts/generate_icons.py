"""
图标生成脚本
从 SVG 源文件生成各尺寸的 PNG 图标

使用方法:
    python scripts/generate_icons.py

需要安装: pip install Pillow cairosvg
"""

import os
import sys

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from PIL import Image
except ImportError:
    print("错误: 需要安装 Pillow")
    print("请运行: pip install Pillow")
    sys.exit(1)

try:
    import cairosvg
except ImportError:
    print("提示: cairosvg 未安装，将使用备用方法")
    print("如需从 SVG 生成，请运行: pip install cairosvg")
    cairosvg = None

# 图标尺寸
SIZES = [72, 96, 128, 144, 152, 180, 192, 384, 512]

# 路径配置
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ICONS_DIR = os.path.join(PROJECT_ROOT, 'app', 'static', 'img', 'icons')
SVG_FILE = os.path.join(ICONS_DIR, 'icon.svg')
APPLE_SVG = os.path.join(ICONS_DIR, 'apple-touch-icon.svg')


def generate_from_svg(svg_path, output_path, size):
    """从 SVG 生成 PNG"""
    if cairosvg:
        cairosvg.svg2png(
            url=svg_path,
            write_to=output_path,
            output_width=size,
            output_height=size
        )
        return True
    return False


def generate_simple_icon(output_path, size):
    """生成简单的占位图标（当无法处理 SVG 时）"""
    from PIL import Image, ImageDraw

    # 创建渐变背景
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 绘制圆角矩形背景
    margin = int(size * 0.06)
    corner_radius = int(size * 0.16)
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=corner_radius,
        fill='#10B981'
    )

    # 绘制白色笔记纸张
    paper_margin = int(size * 0.23)
    paper_width = size - 2 * paper_margin
    paper_height = int(size * 0.625)
    paper_radius = int(size * 0.03)
    draw.rounded_rectangle(
        [paper_margin, int(size * 0.195), paper_margin + paper_width, int(size * 0.195) + paper_height],
        radius=paper_radius,
        fill='white'
    )

    # 绘制线条
    line_color = '#E2E8F0'
    line_y_start = int(size * 0.31)
    line_spacing = int(size * 0.098)
    line_margin = int(size * 0.31)
    line_width = int(size * 0.45)

    for i in range(4):
        y = line_y_start + i * line_spacing
        draw.line(
            [(line_margin, y), (line_margin + line_width - i * int(size * 0.04), y)],
            fill=line_color,
            width=max(1, int(size * 0.008))
        )

    img.save(output_path, 'PNG')
    print(f"  生成简单图标: {os.path.basename(output_path)}")


def main():
    print("开始生成 PWA 图标...")
    print(f"图标目录: {ICONS_DIR}")

    # 检查目录
    if not os.path.exists(ICONS_DIR):
        os.makedirs(ICONS_DIR)
        print(f"创建目录: {ICONS_DIR}")

    # 检查 SVG 文件
    has_svg = os.path.exists(SVG_FILE)
    if has_svg and cairosvg:
        print(f"找到 SVG 源文件: {SVG_FILE}")
        use_svg = True
    elif has_svg and not cairosvg:
        print("SVG 文件存在，但 cairosvg 未安装")
        print("将生成简单占位图标")
        use_svg = False
    else:
        print("未找到 SVG 源文件，将生成简单占位图标")
        use_svg = False

    # 生成各尺寸图标
    for size in SIZES:
        output_file = os.path.join(ICONS_DIR, f'icon-{size}.png')

        if use_svg:
            try:
                generate_from_svg(SVG_FILE, output_file, size)
                print(f"  ✓ icon-{size}.png")
            except Exception as e:
                print(f"  ✗ icon-{size}.png 失败: {e}")
                generate_simple_icon(output_file, size)
        else:
            generate_simple_icon(output_file, size)

    # 生成 Apple Touch Icon
    apple_output = os.path.join(ICONS_DIR, 'apple-touch-icon.png')
    if use_svg:
        svg_source = APPLE_SVG if os.path.exists(APPLE_SVG) else SVG_FILE
        try:
            generate_from_svg(svg_source, apple_output, 180)
            print(f"  ✓ apple-touch-icon.png (180x180)")
        except Exception as e:
            print(f"  ✗ apple-touch-icon.png 失败: {e}")
            generate_simple_icon(apple_output, 180)
    else:
        generate_simple_icon(apple_output, 180)

    print("\n图标生成完成!")
    print(f"\n生成的文件位于: {ICONS_DIR}")
    print("\n注意: 如果使用的是占位图标，建议安装 cairosvg 后重新生成：")
    print("  pip install cairosvg")
    print("  python scripts/generate_icons.py")


if __name__ == '__main__':
    main()
