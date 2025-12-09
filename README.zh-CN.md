# Excalidraw AI Agent (excali-ai)

[English](README.md) | 简体中文

[Work In Progress] **通过自然语言创建和修改 Excalidraw 图。**

本项目基于 [Excalidraw](https://github.com/excalidraw/excalidraw) 及相关开源工具构建。

## 快速开始

需要先安装 [Node.js](https://nodejs.org/) 和 [pnpm](https://pnpm.io/)。

1. 克隆仓库并安装依赖

```bash
git clone https://github.com/elecmonkey/excali-ai
cd excali-ai
pnpm install
```

2.（可选）在服务端配置 OpenAI 兼容的 API  
   - 服务端配置对所有用户生效。  
   - 你也可以跳过这一步，让用户在前端填写 Base URL、Key、Model（仅对该用户生效）。

```bash
cp .env.local.example .env.local
vim .env.local
```

3. 启动开发服务器

```bash
pnpm dev
```

## 参与贡献

欢迎提交 Issue 和 PR！

## 许可证

MIT License
