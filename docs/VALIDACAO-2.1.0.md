# Validação da versão 2.1.0

## Mudanças

- Navegação lateral, ícones locais e paleta grafite/azul acinzentado, com âmbar para seleção, violeta para transcrição e verde discreto para conexão.
- Busca dos 24 estilos por nome, ignorando acentos, com mensagem para busca sem resultados.
- A transcrição retorna o SRT para o editor do painel. O botão Revisar última transcrição abre esse texto; a geração a partir de SRT aplica outro estilo sem repetir o reconhecimento de fala.
- Navegação por teclado com setas verticais e horizontais, Home e End.

## Verificações executadas

`npm test`: 17 testes aprovados. Incluem eventos do painel, transcrição → revisão → nova geração, busca, presets, biblioteca, importação e inserção com adaptadores simulados do Premiere.

`python -m unittest discover -s tests -p 'test_*.py'`: 19 testes aprovados. Incluem FFmpeg real para detecção/corte de silêncio, sincronização de áudio/vídeo, medição de volume normalizado, zoom e vídeo de legendas com canal alfa; conferem eventos dos 24 estilos e trilha de cliques.

Whisper real: áudio de teste em português sintetizado com Microsoft Maria, processado com o modelo base local. Foram gerados quatro blocos SRT com as frases sobre testar legendas, editar vídeo, ajustar volume, cortar pausas e salvar no computador. O SRT retornado para a interface foi comparado ao arquivo gravado.

## Limites desta verificação

Os testes de integração com o Premiere usam adaptadores simulados: não confirmam inserção na timeline de um projeto real nesta rodada. O assistente TypeSafe teve sua validação de respostas testada sem chamada externa nesta rodada. Reconhecimento de fala precisa de revisão, especialmente com idioma incorreto, ruído ou música.

A tentativa de abrir o painel local no navegador para inspeção visual foi recusada pela política de URLs da ferramenta. Não foi realizado contorno. A aparência final no Premiere, inclusive em painel estreito, ainda exige inspeção visual.
