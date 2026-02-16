/**
 * 公共 Markdown 渲染模块
 * 统一处理 Markdown 渲染、Mermaid 图表、代码高亮、图片查看等
 *
 * 用法：
 *   import { renderContent, decodeHtmlEntities, parseWikiLinks } from '/static/js/markdown-renderer.js';
 *   await renderContent(container, content, options);
 */

// 解码 HTML 实体（修复 DOMPurify 导致的 Mermaid 语法问题）
export function decodeHtmlEntities(text) {
    if (!text) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

// 解析 WikiLinks 语法 [[title]] 或 [[title|display]]
export function parseWikiLinks(content) {
    if (!content) return '';
    return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, title, display) => {
        return `<span class="wiki-link" title="${title.trim()}">${(display || title).trim()}</span>`;
    });
}

/**
 * 渲染 Markdown 内容（核心函数）
 * @param {HTMLElement} container - 目标容器
 * @param {string} content - Markdown 原始内容
 * @param {Object} options - 配置选项
 * @param {boolean} options.skipFirstH1 - 是否跳过第一个 h1 标题
 * @param {boolean} options.enableViewer - 是否启用图片查看器（默认 true）
 * @param {boolean} options.enableMermaid - 是否启用 Mermaid 渲染（默认 true）
 * @param {boolean} options.enableHighlight - 是否启用代码高亮（默认 true）
 */
export async function renderContent(container, content, options = {}) {
    if (!container || !content) return;

    const {
        skipFirstH1 = false,
        enableViewer = true,
        enableMermaid = true,
        enableHighlight = true
    } = options;

    try {
        // 1. 处理 WikiLinks
        let processed = parseWikiLinks(content);

        // 2. 移除第一个 h1 标题（避免重复）
        if (skipFirstH1) {
            processed = processed.replace(/^#\s+.+\n?/, '');
        }

        // 3. Markdown 解析
        let html = processed;
        if (typeof marked !== 'undefined') {
            html = marked.parse(processed);
        }

        // 4. 安全清理
        if (typeof DOMPurify !== 'undefined') {
            html = DOMPurify.sanitize(html);
        }

        container.innerHTML = html;

        // 5. 渲染 Mermaid 图表
        if (enableMermaid && typeof mermaid !== 'undefined') {
            await renderMermaidBlocks(container);
        }

        // 6. 代码高亮
        if (enableHighlight && typeof hljs !== 'undefined') {
            container.querySelectorAll('pre code').forEach(block => {
                const isDiagram = block.classList.contains('language-mermaid') ||
                                  block.classList.contains('language-mindmap');
                if (!isDiagram) {
                    hljs.highlightElement(block);
                }
            });
        }

        // 7. 图片查看器
        if (enableViewer && typeof Viewer !== 'undefined') {
            new Viewer(container, {
                button: true,
                navbar: false,
                title: false,
                toolbar: { zoomIn: 1, zoomOut: 1, oneToOne: 1, reset: 1 }
            });
        }

    } catch (e) {
        console.error('Markdown rendering failed:', e);
        container.textContent = content;
    }
}

/**
 * 渲染 Mermaid 图表块
 */
export async function renderMermaidBlocks(container) {
    const blocks = container.querySelectorAll('pre code.language-mermaid, pre code.language-mindmap');
    if (blocks.length === 0) return;

    const nodesToRender = [];

    blocks.forEach(block => {
        const isMindmap = block.classList.contains('language-mindmap');

        // 关键：解码 HTML 实体（修复 DOMPurify 转义问题）
        let rawCode = decodeHtmlEntities(block.textContent);

        // Mindmap 自动添加关键字
        if (isMindmap && !rawCode.trim().startsWith('mindmap')) {
            rawCode = 'mindmap\n' + rawCode;
        }

        const pre = block.parentElement;
        const div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = rawCode;
        div.style.textAlign = 'center';

        if (pre && pre.parentNode) {
            pre.parentNode.replaceChild(div, pre);
            nodesToRender.push(div);
        }
    });

    if (nodesToRender.length > 0) {
        try {
            await mermaid.run({ nodes: nodesToRender });
        } catch (e) {
            console.error('Mermaid rendering failed:', e);
        }
    }
}

/**
 * 初始化 Markdown 渲染器配置
 * 应在页面加载时调用一次
 */
export function initMarkdownRenderer() {
    // 配置 marked
    if (typeof marked !== 'undefined') {
        marked.use({ gfm: true, breaks: true });
    }

    // 配置 highlight.js
    if (typeof hljs !== 'undefined') {
        hljs.configure({ ignoreUnescapedHTML: true });
    }

    // 配置 Mermaid
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({ startOnLoad: false, theme: 'default' });
    }
}

// 默认导出
export default {
    renderContent,
    decodeHtmlEntities,
    parseWikiLinks,
    initMarkdownRenderer
};
