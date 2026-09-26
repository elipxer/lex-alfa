# Revisão de organização e UX — Lex Alfa 2.1.1

Revisão baseada no código, nos fluxos existentes e nas referências visuais fornecidas. Mantida a paleta aprovada: grafite, azul acinzentado, âmbar e violeta.

## Problemas encontrados e correções

| Prioridade | Local | Problema | Correção |
| --- | --- | --- | --- |
| Alta | `index.html:205`, `js/processor-client.js:9` | Andamento, cancelamento e erros ficavam fora da área visível durante a rolagem. | Barra de tarefa fixa fora da área rolável, mensagens globais de início, conclusão e falha, cancelamento acessível. |
| Alta | `index.html:113` | Transcrever aparecia antes da escolha do tipo de saída, sugerindo que SRT receberia o estilo visual. | Opções de saída antes da ação; botão descreve SRT ou vídeo; formato de vídeo aparece apenas quando aplicável. |
| Alta | `index.html`, `js/processor-client.js` | Resultados misturados ao rodapé e nomes repetidos dificultavam localizar o arquivo gerado. | Aba Resultados e atalho permanente com contagem. Cada arquivo mostra a pasta da geração e uma ação de importação. |
| Média | `index.html:33`, `js/main.js` | Seletor de mídia aparecia em ferramentas que não precisam dele. | Seletor aparece em Cortes, Volume e Legendas. Fica oculto em Biblioteca, Sons e Resultados. |
| Média | `js/panel-ui.js` | Selecionar um clipe podia sugerir processamento apenas dos cortes da timeline. | Botão “Usar arquivo do clipe” e aviso de que o arquivo inteiro será processado. |
| Média | `js/legendas.js:85` | Selecionar um estilo recriava a galeria e perdia o foco de teclado. | Foco restaurado no estilo selecionado; nome do estilo e contagem da busca ficam visíveis. |
| Média | `index.html`, `js/panel-ui.js` | Controles +/− e alguns rótulos tinham pouca clareza para leitores de tela. | Nomes acessíveis, associações de rótulos e indicador +/− sincronizado com a expansão. |
| Baixa | `index.html`, `css/style.css` | Títulos promocionais e textos repetidos consumiam espaço de um painel estreito. | Títulos de tarefas diretos, menos repetição e controles compactos. |

## Fluxo resultante

- Biblioteca: adicionar pasta → buscar → ouvir/importar ou escolher arquivo para processamento.
- Cortes e Volume: escolher arquivo → configurar → processar → acompanhar na barra fixa → abrir Resultados.
- Legendas: escolher arquivo → idioma e saída → transcrever → revisar texto → reaplicar estilo quando necessário → importar em Resultados.
- Sons: ouvir os efeitos incluídos → inserir em nova faixa.

## Validação e limites

Testes de interface verificam navegação, visibilidade contextual da mídia, acesso aos resultados, seleção de saída, manutenção do foco e mensagens de conclusão/erro. O processamento mantém o comportamento da 2.1.0; esta revisão não transforma o arquivo de origem em uma exportação da montagem da timeline.

A inspeção visual dentro do Premiere permanece pendente porque o controle de janelas da sessão está indisponível. Não se afirma validação visual em 340 px nem teste de edição em um projeto real nesta revisão. A estrutura responsiva foi inspecionada pelo código.

Critérios de acessibilidade e comunicação consultados: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Aplicados os itens pertinentes a um painel UXP; regras específicas de navegação web, servidor e mobile não foram impostas ao plugin.
