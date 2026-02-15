# 轻笔记 (Light Note Blog) - 个人知识库 & 灵感捕捉

一个受 Flomo 启发的轻量级、智能化的个人笔记应用。旨在提供极致的“零摩擦”记录体验，并结合 AI 技术辅助知识整理。

## 🌟 核心功能

- 🚀 **快速捕捉**：极简的输入界面，支持快捷标签和图片粘贴。
- 🧠 **双向链接**：支持 `[[Wiki链接]]` 语法，自动生成反向链接 (Backlinks)，构建个人知识网络。
- 🤖 **AI 助手**：集成流式 AI 接口，支持自动生成标签、内容摘要、文本润色及自定义 Prompt。
- 🔐 **生物识别登录**：支持 WebAuthn 登录，完美支持Windows Hello，兼顾安全与便捷。
- 📜 **版本控制**：记录笔记的每一次修改，支持随时回滚历史版本。
- 📊 **可视化统计**：支持贡献热力图 (Heatmap) 和全站数据概览。
- 📱 **全平台适配**：响应式设计，完美适配 PC、平板和手机浏览器。

## 🛠️ 技术栈

- **后端**: Python (Flask) + SQLAlchemy
- **数据库**: SQLite (支持通过 Alembic 进行数据库迁移)
- **前端**: 原生 JavaScript (模块化设计) + CSS3 (变量化主题)
- **外部依赖**: OpenAI API (或兼容接口), WebAuthn, Marked.js (Markdown渲染), Mermaid.js (图表)

## 🚀 快速开始

### 1. 环境准备
确保已安装 Python 3.8+。

### 2. 安装依赖
```bash
pip install -r requirements.txt
```

### 3. 配置环境
创建 `.env` 文件并配置以下内容（可选）：
```
SECRET_KEY=你的密钥
PORT=5001
```

### 4. 运行应用
- **开发模式**:
```bash
python run.py
```
- **生产模式**:
```bash
python server.py
```

访问 `http://localhost:5001` 即可开始使用。

## 📁 项目结构

```
轻笔记博客/
├── app/                  # 应用核心代码
│   ├── routes/           # 路由 (Auth, Notes, AI, Stats等)
│   ├── services/         # 业务逻辑 (AI Service)
│   ├── models.py         # 数据库模型
│   ├── static/           # 静态资源 (CSS, JS Modules)
│   └── templates/        # HTML 模板
├── data/                 # 数据库文件 (notes.db)
├── migrations/           # 数据库迁移脚本
├── uploads/              # 用户上传的图片
├── run.py                # 开发环境启动脚本
└── server.py             # 生产环境启动脚本 (Waitress)
```

## 📝 许可证

MIT License
