/**
 * GeminiClient - Google Gemini API integration with function calling for desktop automation
 */

const DESKTOP_FUNCTIONS = [
  {
    name: 'execute_command',
    description: 'Executa um comando no terminal/prompt do sistema operacional. Pode rodar qualquer comando como ls, dir, pwd, echo, scripts, etc. Use para tarefas como listar arquivos, criar diretórios, instalar pacotes, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: {
          type: 'STRING',
          description: 'O comando para executar. Exemplos: "ls -la", "dir", "echo Olá", "mkdir nova_pasta"',
        },
        timeout: {
          type: 'NUMBER',
          description: 'Tempo limite em milissegundos (padrão: 30000)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'take_screenshot',
    description: 'Captura um screenshot da tela atual do computador. Útil para ver o que está na tela, verificar o estado de janelas, ler textos, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        description: {
          type: 'STRING',
          description: 'Motivo do screenshot ou o que procurar',
        },
      },
    },
  },
  {
    name: 'mouse_click',
    description: 'Clica em uma posição específica da tela. As coordenadas (x, y) são em pixels a partir do canto superior esquerdo. Use take_screenshot primeiro para ver a tela e determinar as coordenadas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: {
          type: 'NUMBER',
          description: 'Coordenada X em pixels (horizontal, da esquerda para direita)',
        },
        y: {
          type: 'NUMBER',
          description: 'Coordenada Y em pixels (vertical, de cima para baixo)',
        },
        button: {
          type: 'STRING',
          description: 'Botão do mouse: "left", "right", "middle"',
          enum: ['left', 'right', 'middle'],
        },
        doubleClick: {
          type: 'BOOLEAN',
          description: 'Se deve dar duplo clique',
        },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'mouse_move',
    description: 'Move o cursor do mouse para uma posição específica da tela sem clicar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        x: {
          type: 'NUMBER',
          description: 'Coordenada X em pixels',
        },
        y: {
          type: 'NUMBER',
          description: 'Coordenada Y em pixels',
        },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'type_text',
    description: 'Digita um texto como se o usuário estivesse digitando no teclado. O texto é inserido na posição atual do cursor/foco.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: {
          type: 'STRING',
          description: 'O texto para digitar',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'press_key',
    description: 'Pressiona uma tecla específica ou combinação de teclas. Use para Enter, Tab, Escape, setas, atalhos como Ctrl+C, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        key: {
          type: 'STRING',
          description: 'Nome da tecla. Exemplos: "enter", "tab", "escape", "backspace", "delete", "up", "down", "left", "right", "home", "end", "space", "f1"-"f12", "a"-"z"',
        },
        modifiers: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Teclas modificadoras. Valores possíveis: "alt", "control", "shift", "command"',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'open_app',
    description: 'Abre um aplicativo no computador. Pode ser o nome do executável ou caminho do aplicativo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: {
          type: 'STRING',
          description: 'Nome ou caminho do aplicativo. Exemplos: "firefox", "chrome", "code", "notepad", "nautilus", "/usr/bin/google-chrome"',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'open_url',
    description: 'Abre uma URL no navegador padrão do sistema.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'A URL para abrir. Exemplo: "https://www.google.com"',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'scroll',
    description: 'Rola a tela para cima ou para baixo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        direction: {
          type: 'STRING',
          description: 'Direção do scroll',
          enum: ['up', 'down'],
        },
        amount: {
          type: 'NUMBER',
          description: 'Quantidade de scroll (1-10, padrão: 3)',
        },
      },
      required: ['direction'],
    },
  },
  {
    name: 'get_screen_size',
    description: 'Retorna a resolução da tela (largura e altura em pixels). Útil para calcular coordenadas de clique.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'list_processes',
    description: 'Lista os processos em execução no computador. Útil para verificar se um aplicativo está aberto ou monitorar recursos.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_mouse_position',
    description: 'Retorna a posição atual do cursor do mouse na tela (x, y).',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

const SYSTEM_INSTRUCTION = `Você é o Z Desktop Agent, um assistente de IA que pode controlar o computador do usuário. Você tem acesso a funções que permitem interagir diretamente com o sistema operacional.

CAPACIDADES:
- Executar comandos no terminal
- Capturar screenshots da tela
- Clicar, mover o mouse e digitar texto
- Pressionar teclas e atalhos de teclado
- Abrir aplicativos e URLs
- Rolar a tela
- Verificar processos em execução
- Obter resolução da tela e posição do mouse

DIRETRIZES:
1. Sempre tire um screenshot ANTES de clicar em algo, para saber onde está clicando.
2. Ao executar comandos, prefira comandos seguros. Sempre avise o usuário antes de comandos destrutivos (rm, del, format, etc.).
3. Seja cuidadoso com ações irreversíveis. Peça confirmação quando necessário.
4. Explique o que está fazendo a cada passo.
5. Use português brasileiro para se comunicar com o usuário.
6. Se uma ação falhar, tente entender o motivo e sugira alternativas.
7. Para clicar em elementos específicos, primeiro capture a tela, identifique as coordenadas aproximadas e depois clique.
8. Responda de forma clara e útil, usando markdown para formatação quando apropriado.

IMPORTANTE: Você deve sempre priorizar a segurança do sistema do usuário. Nunca execute comandos que possam danificar o sistema ou comprometer dados sem confirmação explícita.`;

export class GeminiClient {
  constructor(apiKey, model) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(history) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      contents: history,
      tools: [
        {
          function_declarations: DESKTOP_FUNCTIONS,
        },
      ],
      tool_config: {
        function_calling_config: {
          mode: 'AUTO',
        },
      },
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    };

    const maxRounds = 10;
    let round = 0;
    let allActions = [];

    while (round < maxRounds) {
      round++;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || `API Error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];

      if (!candidate) {
        throw new Error('No response candidate from API');
      }

      const parts = candidate.content?.parts || [];

      // Check for function calls
      const functionCalls = parts.filter((p) => p.functionCall);
      const textParts = parts.filter((p) => p.text);

      if (functionCalls.length === 0) {
        // No more function calls - return the text response
        return {
          text: textParts.map((p) => p.text).join(''),
          actions: allActions,
        };
      }

      // Process function calls
      const functionResponses = [];
      for (const fc of functionCalls) {
        const { name, args } = fc.functionCall;
        const actionResult = await this.executeDesktopFunction(name, args);
        allActions.push(actionResult);

        functionResponses.push({
          functionResponse: {
            name,
            response: {
              success: actionResult.success,
              ...(actionResult.success
                ? this.getSuccessResponse(name, actionResult)
                : { error: actionResult.error || 'Unknown error' }),
            },
          },
        });
      }

      // Add model's response to contents
      body.contents.push({
        role: 'model',
        parts: parts,
      });

      // Add function responses to contents
      body.contents.push({
        role: 'function',
        parts: functionResponses,
      });
    }

    return {
      text: 'Atingi o limite de rodadas de automação. Por favor, continue a conversa para mais ações.',
      actions: allActions,
    };
  }

  async executeDesktopFunction(name, args) {
    try {
      let result;
      switch (name) {
        case 'execute_command':
          result = await window.electronAPI.executeCommand(args.command, args.timeout || 30000);
          result.command = args.command;
          result.type = 'execute_command';
          break;

        case 'take_screenshot':
          result = await window.electronAPI.takeScreenshot();
          result.type = 'screenshot';
          result.description = args.description || '';
          break;

        case 'mouse_click':
          result = await window.electronAPI.mouseClick(args.x, args.y, args.button || 'left', args.doubleClick || false);
          result.type = 'mouse_click';
          result.x = args.x;
          result.y = args.y;
          result.button = args.button || 'left';
          break;

        case 'mouse_move':
          result = await window.electronAPI.mouseMove(args.x, args.y);
          result.type = 'mouse_move';
          result.x = args.x;
          result.y = args.y;
          break;

        case 'type_text':
          result = await window.electronAPI.typeText(args.text);
          result.type = 'type_text';
          result.text = args.text;
          break;

        case 'press_key':
          result = await window.electronAPI.pressKey(args.key, args.modifiers || []);
          result.type = 'press_key';
          result.key = args.key;
          result.modifiers = args.modifiers;
          break;

        case 'open_app':
          result = await window.electronAPI.openApp(args.name);
          result.type = 'open_app';
          result.name = args.name;
          break;

        case 'open_url':
          result = await window.electronAPI.openUrl(args.url);
          result.type = 'open_url';
          result.url = args.url;
          break;

        case 'scroll':
          result = await window.electronAPI.mouseScroll(args.amount || 3, args.direction);
          result.type = 'scroll';
          result.direction = args.direction;
          result.amount = args.amount || 3;
          break;

        case 'get_screen_size':
          result = await window.electronAPI.getScreenSize();
          result.type = 'get_screen_size';
          break;

        case 'list_processes':
          result = await window.electronAPI.listProcesses();
          result.type = 'list_processes';
          break;

        case 'get_mouse_position':
          result = await window.electronAPI.getMousePos();
          result.type = 'get_mouse_position';
          break;

        default:
          result = { success: false, error: `Unknown function: ${name}` };
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message, type: name };
    }
  }

  getSuccessResponse(name, result) {
    switch (name) {
      case 'take_screenshot':
        // Don't include base64 in function response to save tokens
        return { captured: true, description: result.description || 'Screenshot captured' };
      case 'execute_command':
        return { exitCode: result.exitCode, stdout: result.stdout?.substring(0, 2000), stderr: result.stderr?.substring(0, 500) };
      case 'get_screen_size':
        return { width: result.width, height: result.height };
      case 'list_processes':
        return { output: result.output?.substring(0, 2000) };
      case 'get_mouse_position':
        return { x: result.x, y: result.y };
      default:
        return { success: true };
    }
  }
}
