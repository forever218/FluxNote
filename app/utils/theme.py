"""
主题系统工具���块

主题目录结构：
app/templates/themes/{theme_name}/
    base.html       - 主题基础模板
    index.html      - 首页
    post.html       - 文章详情
    archive.html    - 归档页
    tags.html       - 标签云
    tag_notes.html  - 标签筛选

app/static/css/themes/{theme_name}.css
"""

import os
from flask import render_template, current_app
from app.models import Config

# 内置主题列表
BUILTIN_THEMES = {
    'default': {
        'name': '默认主题',
        'description': '简洁现代的默认主题',
        'author': '轻笔记',
        'preview': '/static/img/themes/default.png'
    },
    'next': {
        'name': 'Next 主题',
        'description': '仿 Hexo Next 风格，简约优雅',
        'author': '轻笔记',
        'preview': '/static/img/themes/next.png'
    },
    'spa': {
        'name': 'SPA 主题',
        'description': '侧边栏风格，适合笔记展示',
        'author': '轻笔记',
        'preview': '/static/img/themes/spa.png'
    }
}


def get_current_theme():
    """获取当前主题名称"""
    return Config.get('blog_theme', 'default')


def set_theme(theme_name):
    """设置主题"""
    if theme_name not in BUILTIN_THEMES:
        raise ValueError(f"未知主题: {theme_name}")
    Config.set('blog_theme', theme_name, '博客主题')


def get_theme_info(theme_name):
    """获取主题信息"""
    return BUILTIN_THEMES.get(theme_name, {})


def get_all_themes():
    """获取所有可用主题"""
    return BUILTIN_THEMES


def render_theme_template(template_name, **context):
    """
    渲染主题模板

    用法：
        render_theme_template('index.html', notes=notes, **config)
    """
    theme = get_current_theme()
    theme_template = f"themes/{theme}/{template_name}"

    # 检查主题模板是否存在，不存在则使用默认主题
    template_dir = os.path.join(current_app.root_path, 'templates', 'themes', theme)
    if not os.path.exists(os.path.join(template_dir, template_name)):
        theme_template = f"themes/default/{template_name}"

    return render_template(theme_template, **context)


def get_theme_css_url():
    """获取当前主题的 CSS URL"""
    theme = get_current_theme()
    return f"/static/css/themes/{theme}.css"
