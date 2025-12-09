# Excalidraw AI Agent (excali-ai)

English | [简体中文](README.zh-CN.md)

[Work in Progress] **AI-powered diagram editor that lets users create and modify Excalidraw diagrams through natural language.**

This project is built on top of [Excalidraw](https://github.com/excalidraw/excalidraw) and related open-source tools.

## Getting Started

You should have [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/) installed.

1. Clone the repository & Install dependencies

```bash
git clone https://github.com/elecmonkey/excali-ai
cd excali-ai
pnpm install
```

2. (Optional) Configure an OpenAI-compatible provider on the server  
   - Server config is shared by everyone.  
   - You can skip this and let users fill Base URL / Key / Model in the client UI (only for themselves).

```bash
cp .env.local.example .env.local
vim .env.local
```

3. Start the development server

```bash
pnpm dev
```

## Contributing

Issues & PR welcomes!

## License

MIT License
