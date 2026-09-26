# Comparação funcional — 25/09/2026

Referência: [página pública do Diorgy Santos](https://www.diorgysantos.com/). Comparação das funcionalidades anunciadas, sem acesso ao produto pago. Os números de templates variam no material público e não foram tratados como inventário verificado. As implementações e os assets desta atualização são próprios.

| Recurso anunciado | Situação no Lex Alfa 1.2 |
| --- | --- |
| Transcrição e corte de silêncios | Já disponíveis por Whisper/FFmpeg; geram cópias do arquivo inteiro. |
| Textos animados e empilhados | 24 estilos, pilha de palavras e cinco opções de entrada; saída MOV com alpha. |
| Importação de SRT e presets | Editor de SRT, reaplicação de estilo e presets nomeados. |
| MOGRT e biblioteca de templates | Pastas persistentes, filtros, favoritos, prévia associada e aplicação de MOGRT existente. |
| Efeitos sonoros e overlays | Cinco sons sintéticos e quatro overlays estáticos originais; aceita bibliotecas pessoais. |
| Sugestão de edição por IA | TypeSafe escolhe opções a partir da descrição; usuário revisa e aplica. |
| Zoom e zona segura | Cópia com zoom central fixo; guia de margens personalizáveis nas legendas. |

## Limites mantidos explícitos

- Não reproduz o catálogo comercial, templates proprietários, cursos ou sistema de licenciamento.
- O painel é para Premiere UXP, não para After Effects. Não gera MOGRT editável; aplica os arquivos fornecidos pelo usuário.
- IA não analisa mídia nem monta automaticamente a timeline. Zoom é fixo, sem seleção semântica de momentos.
- Tempos por palavra são estimados. Empilhamento faz parte do vídeo de legenda renderizado, não cria camadas nativas de texto independentes.
- A integração nativa ainda precisa de validação no Premiere; testes automatizados não substituem esse teste.
