# Lex Alfa 2.0.1

Painel UXP para Premiere Pro 25.6+ com biblioteca de mídia local e processamento com FFmpeg/Whisper. HTML, CSS e JavaScript sem etapa de compilação. Nenhuma operação de edição usa resultados simulados.

## Usar no Premiere

1. Dê dois cliques em `releases/Lex-Alfa-2.0.1-Windows.ccx` e confirme a instalação local no Creative Cloud. Se o Windows não abrir o Adobe, baixe o arquivo `Instalar-Lex-Alfa-2.0.1.vbs` da publicação, deixe-o ao lado do `.ccx` e abra o `.vbs` para chamar o instalador da Adobe diretamente.
2. Abra **Lex Alfa** no menu de plugins do Premiere e clique em **Ativar Lex Alfa**. Aceite a confirmação de abertura do processador incluído; ela pode ser lembrada pelo Adobe.
3. Python, FFmpeg e o modelo de transcrição já acompanham o instalador. Não há terminal ou instalação separada de dependências. A conexão automática é configurável no painel.

Instruções curtas: [instalação](docs/INSTALAR.md).

### Biblioteca e edição

2. Na aba **Biblioteca**, clique em **Adicionar pasta** e escolha suas pastas de músicas/efeitos. O painel lembra o acesso entre sessões usando tokens UXP.
3. Pesquise por nome/pasta, filtre por extensão e marque favoritos. **Prévia** abre no monitor de origem; **Parar prévia** interrompe a reprodução.
4. **Importar** adiciona ao painel Projeto, reutilizando uma mídia já importada com o mesmo caminho. **Adicionar em nova faixa** adiciona o arquivo no playhead em uma nova faixa de áudio, em uma transação que permite desfazer pelo Premiere.

A biblioteca aceita áudio, vídeo, imagens e MOGRT; os formatos estão detalhados abaixo e a decodificação depende do Premiere. Inclui busca em subpastas, cancelamento da busca, paginação de 100 resultados, deduplicação por caminho e limite de 10.000 arquivos por atualização. Remover uma pasta da lista não remove arquivos. Pastas movidas, desconectadas ou com tokens inválidos devem ser adicionadas novamente.

## Recursos

### Instalação e interface da versão 2.0.1

Pacote CCX offline para Windows x64. O executável incluído roda sem console; toda a operação fica no painel UXP acoplável. A interface usa seleção de arquivo no topo, estado de conexão, ativação/reconexão, resultados com nomes curtos e pasta de exportação acessível. Opções avançadas de legenda ficam em grupos expansíveis; abas têm navegação por teclado e animações respeitam a preferência de movimento reduzido.

Conexão autenticada em loopback; token e estado ficam em `~/AppData/Local/LexAlfa`, separados dos arquivos instalados. O processador encerra após 20 minutos sem painel conectado e sem tarefas. O aplicativo não adiciona inicialização automática ao Windows. A confirmação nativa de abertura do Adobe permanece.

### Novidades da versão 1.2

- **Biblioteca multimídia:** além de áudio, aceita MOGRT, MP4, MOV, WEBM, AVI, PNG, JPG/JPEG e WEBP. Filtre por tipo, extensão, pasta ou favoritos. Um MOGRT pode ter uma prévia com o mesmo nome na mesma pasta, por exemplo `titulo.mogrt` e `titulo.mp4`. **Aplicar MOGRT** insere no playhead em novas faixas; fontes, compatibilidade e dependências continuam sendo do template.
- **Overlays incluídos:** quatro PNGs transparentes originais de grão, vinheta, luz quente e linhas, em 1920×1080. Adicione-os pela Biblioteca, importe e arraste acima do vídeo. Ajuste escala, duração e opacidade no Premiere. São imagens estáticas.
- **24 estilos de legenda**, incluindo pilha de palavras, duotone, neon e cinema. Entrada sem movimento, fade, zoom, slide ou bounce; posição superior, central ou inferior; guia visual e margens ajustáveis. A guia não aparece na exportação. As margens são personalizáveis, não uma garantia de compatibilidade com todas as redes sociais.
- **Presets nomeados:** salve, carregue e remova até 100 combinações de estilo. **Editor SRT:** abra, revise e renderize legendas existentes sem transcrever novamente. Até 200.000 caracteres, 5.000 legendas e duas horas. A divisão por palavras redistribui os tempos proporcionalmente; revise a sincronização. O estilo é aplicado ao MOV transparente, não ao SRT simples.
- **Sugestões de edição:** descreva objetivo, público e enquadramento. O TypeSafe sugere estilo, animação e intensidade de zoom, com confiança exibida. Somente a descrição é enviada; a mídia fica local. **Aplicar sugestão** seleciona opções; a geração continua manual. A credencial fica no ambiente `TYPESAFE_API_KEY` ou no arquivo local autorizado, nunca no painel.
- **Cópia com zoom:** aproximação central fixa de 8% ou 15% durante todo o arquivo, exportada como MP4 H.264/AAC. Aceita vídeo sem áudio. Não identifica rostos, não escolhe momentos da montagem nem anima o enquadramento.

Veja a [comparação funcional](docs/REFERENCIA-FUNCIONAL.md). Recursos nativos de MOGRT e biblioteca precisam de validação no Premiere real; os testes de adaptador usam objetos controlados.

### Executar a partir do código (desenvolvimento)

Estas instruções são apenas para desenvolver sem o instalador. Requerem **Python 3** e **FFmpeg/ffprobe** no PATH. O usuário do CCX não precisa executar estes comandos. A transcrição requer FFmpeg com o filtro `whisper`.

```powershell
# Na pasta do projeto, inicia o processador em segundo plano, sem abrir janela:
.\Iniciar-LexAlfa.ps1

# Instala/verifica o modelo Whisper base multilíngue (~142 MB):
python processor/setup_model.py

# Para encerrar o processador (cancele tarefas pelo painel antes):
.\Parar-LexAlfa.ps1
```

O modelo já foi instalado em `.runtime/models/` durante o desenvolvimento neste computador. Essa pasta é local e não entra no versionamento. Em outra instalação, execute o instalador novamente. O download verifica SHA-256 contra os metadados LFS do publicador. Depois do download, transcrição e processamento funcionam localmente, sem enviar mídia ou transcrição para serviços externos. O botão opcional de sugestões por IA envia somente a descrição digitada ao TypeSafe.

Escolha um arquivo com **Escolher arquivo**, **Usar seleção da timeline** ou **Processar** na biblioteca. **Reconectar** recupera a conexão com o processador.

**O processamento usa o arquivo de origem completo, não o trecho cortado, os efeitos ou a montagem da timeline.** Para processar uma montagem, exporte-a do Premiere e selecione o arquivo exportado.

- **Respiros:** detecta silêncio por amplitude, com sensibilidade e duração mínima. A opção de preservar pausas mantém intervalos de pelo menos 1 segundo; não interpreta intenção dramática. Revise/desmarque intervalos antes de gerar a cópia. Há uma margem de 40 ms nas bordas. Até 300 intervalos por operação. O resultado é WAV para áudio ou MP4 H.264/AAC para vídeo, usando a primeira faixa de áudio e o primeiro vídeo que não seja capa de álbum.
- **Volume:** normalização EBU R128 em duas passagens, com alvo LUFS e teto de pico verdadeiro. Mede novamente o arquivo final e mostra os valores obtidos. Gera WAV PCM 24-bit/48 kHz da primeira faixa de áudio. Aplicar o mesmo alvo a arquivos diferentes nivela o loudness; não modifica automaticamente os clipes existentes da timeline.
- **Legendas:** Whisper local produz SRT com tempos e texto. Português, inglês, espanhol ou detecção de idioma. Importe o SRT pelo resultado ou pelo botão **Importar SRT existente** e arraste-o para a sequência. A opção de vídeo transparente renderiza o template como MOV ProRes 4444 com alpha, em vertical, horizontal ou quadrado, a 30 fps. Importe e posicione numa faixa acima da imagem, alinhado ao início do arquivo original. Revise a transcrição: o modelo pode omitir ou reconhecer incorretamente palavras.
- **SFX:** cinco WAVs sintéticos originais incluídos: Clique, Whoosh, Pop, Ding e Impacto. Dentro do Premiere são copiados para o armazenamento persistente do plugin antes da importação, para evitar links para arquivos temporários.

Os resultados ficam em `~/Documents/Lex Alfa/Exports`, em uma pasta única por operação. Cada arquivo gerado tem seu botão **Importar no projeto**; os 20 resultados mais recentes ficam disponíveis após reabrir o painel. Os originais são mantidos. Não mova as cópias depois de vinculá-las ao Premiere. É possível cancelar o processamento; resultados parciais dessa operação são removidos.

Para mudar a pasta de saída, pare a instância atual e inicie manualmente:

```powershell
python processor/server.py --output-dir "D:\Edicao\Lex Alfa"
```

O serviço escuta apenas `127.0.0.1:47831`, exige token para todas as operações e recebe apenas comandos fixos de processamento. O token fica em `~/AppData/Local/LexAlfa`, separado da instalação; no modo de desenvolvimento, usa `.runtime/connection.json`. O manifesto permite apenas esse endereço de rede. Não publique a pasta `.runtime` por um servidor web.

## Templates e limites atuais

Os 24 templates têm prévias no painel e versões renderizadas com cor, fonte e tamanho. O estilo Manchete permite destacar de 1 a 6 palavras e gerar uma trilha WAV com cliques no início de cada frase. Alinhe essa trilha ao início do vídeo transparente. É possível salvar/carregar um estilo, e as preferências gerais persistem localmente. Fontes precisam estar instaladas; o sistema pode usar uma substituta.

**SRT não transporta esses estilos.** O MOV transparente aplica o visual; o SRT continua sendo a alternativa de texto editável. `legendas.ass` e `estilo-referencia.json` acompanham a renderização. Karaokê, Pop e Máquina de escrever têm animações com tempos estimados dentro de cada frase, não alinhamento fonético por palavra. Caixas e balão são aproximações vetoriais dos previews; o formato ASS não reproduz todo o CSS. A renderização usa libass e pode produzir arquivos grandes, especialmente em fontes longas.

Ainda não há geração de MOGRT editável, edição direta da montagem por silêncio nem interpretação semântica de pausas. As operações reais atuam sobre o arquivo completo e produzem cópias. A antiga simulação desses comportamentos foi retirada para que o painel não anuncie sucesso sem executar a tarefa.

## Prévia no navegador

Abra `index.html` no navegador. As abas, estilos, filtros, favoritos e reprodução de arquivos selecionados podem ser usados. No navegador, adicione uma pasta novamente após recarregar; os caminhos nativos e a importação no Premiere não estão disponíveis. Para servir a interface em desenvolvimento, exponha apenas HTML/CSS/JS/assets/icons, nunca `.runtime`.

## Código e testes

```text
js/core.js               Preferências, mensagens, fonte e exclusão de operações concorrentes
js/premiere-bridge.js    APIs reais de projeto, sequência, importação e monitor de origem
js/media-library.js      Pastas, tokens persistentes, busca, favoritos e reprodução
js/processor-client.js   Comunicação autenticada, progresso e cancelamento
js/respiros.js           Revisão de intervalos e geração de cópia
js/volume.js             Normalização local
js/legendas.js           Templates e transcrição/SRT
js/sfx.js                Efeitos incluídos
js/main.js               Inicialização e navegação
processor/server.py      Worker FFmpeg, fila, validação e API local
processor/captions.py     Estilos ASS, animações e trilha sincronizada de cliques
processor/setup_model.py Download e verificação do modelo Whisper
scripts/build_assets.py  Geração reproduzível dos efeitos e ícones
tests/                   Regressões DOM/API e processamento de áudio real
```

```powershell
npm ci
npm test
python -m unittest discover -s tests -p 'test_*.py'
```

JavaScript usa `jsdom` apenas nos testes; o plugin não precisa de `node_modules`. Python usa a biblioteca padrão; Pillow é necessário apenas para regenerar os ícones com `scripts/build_assets.py`, não para executar o processador.

Para gerar o CCX em Windows x64, instale PyInstaller no ambiente de build e execute `python scripts/package_windows.py --ffmpeg-dir CAMINHO_DA_PASTA_BIN`. O script verifica o modelo, empacota o interpretador sem console, inclui binários/modelo/licenças, valida o ZIP e gera o SHA-256. Usa uma lista explícita de arquivos; `.runtime`, credenciais e mídia do usuário não entram no CCX. Licenças e referências de código de terceiros ficam em `licenses/`. Não inclui assinatura Authenticode do executável.

Validação realizada: testes automatizados do DOM, falhas e concorrência, adapter do Premiere com objetos de teste, processamento FFmpeg de áudio/vídeo real, preservação do original, rejeição de análise desatualizada, autenticação HTTP, transcrição de voz sintetizada, transparência do MOV e sincronização da trilha de cliques. **Carregamento UXP, reprodução no monitor e inserção na timeline ainda precisam de teste dentro do Premiere**, que não estava aberto no ambiente de desenvolvimento.

Referências: [Adobe Project](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/project), [SequenceEditor](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequenceeditor), [SourceMonitor](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sourcemonitor), [armazenamento UXP](https://developer.adobe.com/uxp/guides/how-to/recipes/filesystem-operations/), [filtros FFmpeg](https://ffmpeg.org/ffmpeg-filters.html).
