# Adaptador Paperclip para PicoClaw

Um plugin adaptador externo para o [Paperclip](https://paperclip.ing) que permite a execução de agentes LLM usando o [PicoClaw](https://github.com/sipeed/picoclaw).

Este adaptador age como uma ponte: o Paperclip lida com a orquestração (painel de controle, tarefas, habilidades), enquanto o PicoClaw atua como o motor de execução remota, rodando o modelo e as ferramentas locais (terminal, arquivos) através do Protocolo WebSocket Pico.

*Read this in [English](README.md)*

## Pré-requisitos

1. **Paperclip** rodando (v2026.414+ com suporte a plugins NPM).
2. **PicoClaw Gateway** rodando e acessível na rede.
3. **Node.js + npm/npx** instalados na máquina do PicoClaw (obrigatório para a configuração recomendada via MCP do Paperclip).

## Como Funciona

Quando um heartbeat (pulso) do Paperclip é acionado, este adaptador envia o prompt contextual e as habilidades (skills) para o PicoClaw. O LLM operando dentro do PicoClaw realiza o trabalho localmente. Ele se comunica de volta com o Paperclip (para assumir tarefas, fazer comentários, etc.) usando ferramentas MCP nativas ou recorrendo a comandos `curl` gerados pelo guia integrado no adaptador.

## Instalação e Configuração

### 1. Configuração do Gateway PicoClaw (Crucial)

Para a melhor experiência, você deve instalar o servidor MCP do Paperclip no ambiente do PicoClaw para que o LLM interaja de forma nativa com a API do Paperclip.

O ambiente do PicoClaw precisa conseguir executar `npx`. No Alpine Linux, instale os pacotes mínimos necessários com:

```bash
apk add --no-cache nodejs npm
```

Nas configurações do seu PicoClaw (no JSON de MCPs/Tools), registre o Servidor MCP oficial:

```json
"servers": {
  "paperclip": {
    "enabled": true,
    "command": "npx",
    "args": [
      "-y",
      "@paperclipai/mcp-server"
    ],
    "type": "stdio",
    "env": {
      "PAPERCLIP_API_URL": "http://<SEU_IP_PAPERCLIP>:3100",
      "PAPERCLIP_API_KEY": "pcp_seu_token_de_agente_ou_empresa_aqui",
      "PAPERCLIP_COMPANY_ID": "<UUID_DA_SUA_EMPRESA>"
    }
  }
}
```

*Nota: A variável `PAPERCLIP_API_URL` deve apontar para a porta bruta da API (geralmente `:3100`), e não para um proxy externo que serve o HTML da interface.*

### 2. Instalação no Paperclip

Instale o adaptador no ambiente onde o Paperclip roda:
```bash
npm install paperclip-adapter-picoclaw
```

Adicione o plugin à sua configuração `paperclip.json`:
```json
{
  "adapters": {
    "picoclaw": "paperclip-adapter-picoclaw"
  }
}
```

### 3. Configuração do Agente na UI

Dentro da Interface Web do Paperclip, crie ou edite um Agente e selecione o adaptador `picoclaw`. Você precisará fornecer:

- **PicoClaw Gateway URL:** O endpoint WebSocket do seu servidor PicoClaw. Lembre-se que o caminho nativo da API Pico sempre termina com `/ws` (ex: `ws://10.0.0.5:18790/pico/ws`).
- **Authentication Token:** O token que corresponde à configuração `channels.pico.token` do PicoClaw.
- **Run Timeout & Grace Period:** Garanta que o timeout seja longo o suficiente para o PicoClaw realizar operações complexas.

## Limitações Conhecidas

- **Seleção Dinâmica de Modelo:** O Protocolo WebSocket Pico atualmente não aceita que o cliente modifique dinamicamente qual modelo usar. O modelo do LLM é totalmente definido pelo YAML interno do servidor PicoClaw (`agents.defaults.model_name`), e não pela interface do Paperclip.
- **Alternativa sem MCP (Fallback):** Se o servidor MCP não estiver configurado no PicoClaw, o adaptador forçará o LLM a usar `curl` via bash para interagir com o Paperclip. Embora funcione, é muito mais lento e propenso a falhas. Recomendamos fortemente a configuração do MCP.

## Resolução de Problemas

- **Erro: `tool not found: paperclip`**  
  O LLM tentou usar as ferramentas nativas do Paperclip, mas o servidor MCP não está registrado ou não iniciou no PicoClaw. Revise as instruções de configuração.
- **O Agente recebe HTML em vez de JSON da API**  
  Sua `PAPERCLIP_API_URL` está apontando para o roteador frontend da interface em vez da API backend bruta. Certifique-se de que aponta para a porta `3100` sem barras no final.
- **Erro: `Input token count exceeds...`**  
  O LLM entrou em loop ou leu arquivos muito grandes. Limpe a memória/workspace do PicoClaw ou troque para um modelo com maior janela de contexto no servidor do PicoClaw.
- **Erro: `npx: not found` ou servidor MCP não inicia**  
  Instale Node.js e npm/npx no ambiente do PicoClaw. No Alpine: `apk add --no-cache nodejs npm`.

## Contribuindo

Nós adoramos contribuições! Se você encontrou um bug, tem uma ideia de funcionalidade ou quer codar algo, sua ajuda é muito bem-vinda.

Por favor, leia o nosso [Guia de Contribuição](CONTRIBUTING.pt-BR.md) para saber como participar. Pessoas de todos os níveis de experiência são bem-vindas!

