# Z Desktop Agent

**Assistente de IA com controle total do computador**

Um aplicativo desktop para Linux (.deb / AppImage) e Windows (.exe) que permite conversar com uma IA (Google Gemini) e dar tarefas que envolvem controle direto do computador: clicar na tela, executar comandos, abrir aplicativos, tirar screenshots, mover janelas e muito mais.

## Funcionalidades

- **Interface estilo ChatGPT** — sidebar com histórico, markdown, código formatado
- **API Key do Google** — o usuário conecta sua própria chave do Google AI Studio
- **Escolha de modelo** — Gemini 2.0 Flash, 2.5 Pro, 2.5 Flash, etc.
- **Screenshot** — captura a tela e envia para a IA analisar
- **Executar comandos** — roda comandos no terminal/prompt
- **Clique do mouse** — clica em coordenadas específicas
- **Digitar texto** — simula digitação no teclado
- **Pressionar teclas** — atalhos como Ctrl+C, Alt+Tab, etc.
- **Abrir aplicativos** — lança programas do sistema
- **Abrir URLs** — abre links no navegador padrão
- **Scroll** — rola a tela para cima ou baixo
- **Listar processos** — verifica o que está rodando
- **Posição do mouse** — obtém coordenadas atuais do cursor

## Instalação Rápida

### Linux (já compilado!)

Os instaladores para Linux já estão prontos na pasta `dist/`:

```bash
# Instalar o .deb (Debian/Ubuntu)
sudo dpkg -i dist/z-desktop-agent_1.0.0_amd64.deb

# OU usar o AppImage (qualquer distro Linux)
chmod +x "dist/Z Desktop Agent-1.0.0.AppImage"
./dist/Z\ Desktop\ Agent-1.0.0.AppImage
```

### Windows

Para compilar o .exe para Windows, você precisa de uma máquina Windows:

```bash
# No Windows, com Node.js 18+ instalado:
git clone <este-repositório>
cd z-desktop-agent

# Instalar dependências
npm install

# Compilar para Windows
npm run pack:win
```

O instalador será gerado em `dist/Z Desktop Agent Setup 1.0.0.exe`.

### Compilando do Zero (qualquer plataforma)

```bash
# Instalar dependências
npm install

# Compilar o frontend
npm run build

# Gerar pacotes Linux
npm run pack:linux

# Gerar pacotes Windows (precisa estar no Windows ou ter wine instalado)
npm run pack:win
```

## Dependências do Sistema (Linux)

Para automação de mouse/teclado sem robotjs, instale:

```bash
# Debian/Ubuntu
sudo apt-get install xdotool scrot imagemagick

# Fedora
sudo dnf install xdotool scrot ImageMagick

# Arch
sudo pacman -S xdotool scrot imagemagick
```

Para compilar com robotjs (melhor precisão):

```bash
# Debian/Ubuntu
sudo apt-get install build-essential libxtst-dev libx11-dev libxinerama-dev libxdo-dev

# Depois:
npx electron-rebuild
```

## Configuração

1. Abra o aplicativo
2. Clique em **Configurações** (ícone de engrenagem na sidebar)
3. Cole sua **API Key do Google** (obtenha em [aistudio.google.com](https://aistudio.google.com))
4. Escolha o **modelo de IA** desejado:
   - **Gemini 2.0 Flash** — Rápido e eficiente, ideal para tarefas do dia a dia
   - **Gemini 2.5 Flash** — Equilíbrio entre velocidade e inteligência
   - **Gemini 2.5 Pro** — Mais inteligente, ideal para tarefas complexas
5. Clique em **Salvar**

## Como Usar

Converse com a IA naturalmente! Exemplos:

- "Tire um screenshot da minha tela"
- "Execute o comando ls -la na minha pasta home"
- "Abra o Firefox"
- "Clique no botão Salvar"
- "Digite 'Olá Mundo' no editor de texto"
- "Abra o site google.com"
- "Liste os processos em execução"
- "Qual a resolução da minha tela?"
- "Pressione Alt+Tab para trocar de janela"
- "Role a tela para baixo"

## Arquitetura

```
┌─────────────────────────────────────┐
│           Electron App              │
├──────────────┬──────────────────────┤
│  Main Process│   Renderer Process   │
│   (Node.js)  │   (React + Tailwind) │
│              │                      │
│ - Comandos   │ - Interface ChatGPT  │
│ - Screenshots│ - Markdown rendering │
│ - Mouse/KB   │ - Gemini API client  │
│ - Apps       │ - Function calling   │
│ - IPC bridge │ - Conversation mgmt  │
├──────────────┴──────────────────────┤
│          Google Gemini API          │
│    (Function Calling + Vision)      │
└─────────────────────────────────────┘
```

### Fluxo de Function Calling

1. Usuário envia mensagem
2. Frontend envia para Gemini API com declarações de funções
3. Gemini decide qual função chamar (ex: take_screenshot)
4. Frontend executa a função via IPC (Electron main process)
5. Resultado é enviado de volta ao Gemini
6. Gemini continua o raciocínio com o resultado
7. Resposta final é exibida ao usuário

## Segurança

- A API Key é armazenada **localmente** no seu computador
- A IA sempre pede confirmação antes de comandos destrutivos
- Todas as ações são registradas no chat para auditoria
- O usuário tem controle total sobre o que a IA executa
- Nenhum dado é enviado para terceiros (apenas Google API)

## Estrutura do Projeto

```
z-desktop-agent/
├── assets/                    # Ícone do aplicativo
├── dist/                      # Build output (instaladores)
│   ├── z-desktop-agent_1.0.0_amd64.deb   # Linux DEB
│   ├── Z Desktop Agent-1.0.0.AppImage     # Linux AppImage
│   └── renderer/              # Frontend compilado
├── src/
│   ├── main/
│   │   └── main.js            # Electron main process
│   ├── preload/
│   │   └── preload.js         # IPC bridge (segurança)
│   └── renderer/
│       ├── index.jsx           # Entry point React
│       ├── App.jsx             # Componente principal
│       ├── components/
│       │   ├── ChatArea.jsx    # Área de chat com mensagens
│       │   ├── Sidebar.jsx     # Sidebar com histórico
│       │   ├── SettingsModal.jsx # Modal de configurações
│       │   ├── TitleBar.jsx    # Barra de título customizada
│       │   └── WelcomeScreen.jsx # Tela de boas-vindas
│       ├── styles/
│       │   └── globals.css     # Estilos globais + Tailwind
│       └── utils/
│           └── geminiClient.js # Cliente Gemini com function calling
├── package.json
├── webpack.renderer.js
├── tailwind.config.js
├── postcss.config.js
├── setup.sh / setup.bat        # Scripts de setup
├── build.sh / build.bat        # Scripts de build
└── README.md
```

## Tecnologias

- **Electron** — aplicativo desktop multi-plataforma
- **React 18** — interface de usuário
- **Tailwind CSS** — estilização
- **Google Gemini API** — IA com function calling
- **robotjs / xdotool** — automação de mouse e teclado
- **screenshot-desktop / scrot** — captura de tela
- **electron-builder** — empacotamento .deb e .exe
- **webpack** — build do frontend

## Licença

MIT
