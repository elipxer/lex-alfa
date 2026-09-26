# Lex Alfa

Plugin UXP para Premiere Pro: corta respiros/silêncios, nivela volume,
gera legendas automáticas com templates customizáveis e insere efeitos
sonoros na timeline.

## Estrutura

```
lex-alfa/
├── manifest.json          # manifesto UXP (host.app: "premierepro", minVersion 25.6.0)
├── index.html              # painel com as 4 abas
├── css/style.css
├── js/
│   ├── premiere-bridge.js  # camada única de acesso à API do Premiere (com fallback pro mock)
│   ├── dev-mock.js         # simula dados do Premiere pra testar fora dele
│   ├── respiros.js
│   ├── volume.js
│   ├── legendas.js         # 14 templates + customização de cor/tamanho/fonte
│   ├── sfx.js
│   └── main.js
└── icons/icon.png          # adicione um ícone 23x23 (e @2x) aqui
```

## Abas

1. **Respiros** — sensibilidade de detecção, duração mínima do corte, opção de
   preservar pausas dramáticas, botões de detectar e cortar.
2. **Volume** — volume alvo em LUFS, limitador de pico em dB, nivelamento
   automático entre clipes distintos.
3. **Legendas** — 14 templates (Clássica, Negrito impacto, Karaokê,
   Minimalista, Bold limpo/Reels, Manchete, Elegante cursiva, Caixa de
   destaque, Contorno grosso, Pop de palavra, Máquina de escrever, Balão de
   fala, Meme e Caixa karaokê), todos com cor, tamanho e fonte
   customizáveis. O template Manchete tem controle extra de quantas
   palavras entram no destaque e efeito sonoro de clique opcional.
4. **SFX** — biblioteca de 5 efeitos (Clique, Whoosh, Pop, Ding, Impacto)
   com preview de áudio e inserção no playhead da timeline.

## Testando sem abrir o Premiere

Abra `index.html` com o Live Server do VS Code (ou qualquer servidor
estático). Como `require("premierepro")` não existe no navegador, o
`premiere-bridge.js` cai automaticamente no `dev-mock.js`, que simula
segmentos de silêncio, geração de legendas etc. Um selo "modo teste
local" aparece no topo do painel quando isso acontece.

## Testando dentro do Premiere

1. Instale o [UDT (UXP Developer Tool)](https://developer.adobe.com/premiere-pro/uxp/guides/).
2. Adicione o plugin apontando pro `manifest.json`.
3. Confirme que está no Premiere Pro **25.6 ou mais recente** — versões
   anteriores rejeitam o plugin com "incorrect host.app specified", já
   que o `host.app` precisa ser `"premierepro"` em minúsculas.

## Próximos passos sugeridos

- Substituir `dev-mock.js`/`premiere-bridge.js` pelas chamadas reais da
  API do Premiere (detecção de silêncio via análise de waveform,
  transcrição pra gerar as legendas, etc.) — hoje ambos retornam dados
  simulados.
- Adicionar os arquivos de áudio reais em `assets/sfx/` (hoje o preview
  no modo mock usa um beep sintetizado via Web Audio API).
- Adicionar o ícone do plugin em `icons/icon.png`.
