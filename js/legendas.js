/**
 * legendas.js
 * Templates de legenda automática. Todos aceitam customização de
 * cor de destaque, tamanho de fonte e família de fonte.
 * Template "manchete" tem controle extra de nº de palavras destacadas + SFX de clique.
 */
const LegendasTab = (() => {
  const TEMPLATES = [
    { id: "classica", nome: "Clássica", preview: (c) => `<span class="tword">legenda aqui</span>` },
    { id: "negrito-impacto", nome: "Negrito impacto", preview: (c) => `<span class="tword" style="-webkit-text-stroke:1px #000;">IMPACTO</span>` },
    { id: "karaoke", nome: "Karaokê", preview: (c) => `<span class="tword">tá <span style="color:${c}">bombando</span></span>` },
    { id: "minimalista", nome: "Minimalista", preview: (c) => `<span class="tword" style="font-weight:400; color:#ddd;">minimalista</span>` },
    { id: "bold-limpo-reels", nome: "Bold limpo (Reels)", preview: (c) => `<span class="tword">frase curta aqui</span>` },
    { id: "manchete", nome: "Manchete", preview: (c) => `<span class="tword" style="color:${c};">300% de ROI</span>` },
    { id: "elegante-cursiva", nome: "Elegante (cursiva)", preview: (c) => `<span class="tword" style="font-style:italic;">com estilo</span>` },
    { id: "caixa-destaque", nome: "Caixa de destaque", preview: (c) => `<span class="tword" style="background:${c}; color:#111; padding:2px 7px; border-radius:4px;">palavra</span>` },
    { id: "contorno-grosso", nome: "Contorno grosso", preview: (c) => `<span class="tword" style="-webkit-text-stroke:2px #000;">LEGENDA</span>` },
    { id: "pop-palavra", nome: "Pop de palavra", preview: (c) => `<span class="tword">isso é <span style="color:${c}; display:inline-block; transform:translateY(-2px) scale(1.15);">incrível</span></span>` },
    { id: "maquina-escrever", nome: "Máquina de escrever", preview: (c) => `<span class="tword" style="border-bottom:2px solid #fff;">digitando</span>` },
    { id: "balao-fala", nome: "Balão de fala", preview: (c) => `<span class="tword" style="background:#fff; color:#111; padding:3px 9px; border-radius:12px;">fala aí</span>` },
    { id: "meme", nome: "Meme (inclinado)", preview: (c) => `<span class="tword" style="transform:rotate(-2deg); display:inline-block;">meme style</span>` },
    { id: "caixa-karaoke", nome: "Caixa karaokê", preview: (c) => `<span class="tword">isso <span style="background:${c}; color:#111; padding:2px 6px; border-radius:4px;">funciona</span> bem</span>` },
    { id: 'neon', nome:'Neon', preview:c=>`<span class="tword" style="color:${c}; text-shadow:0 0 5px ${c};">luz na ideia</span>` },
    { id: 'placa-escura', nome:'Placa escura', preview:c=>`<span class="tword" style="color:${c}; background:#151515; padding:4px;">sua mensagem</span>` },
    { id: 'faixa-editorial', nome:'Faixa editorial', preview:c=>`<span class="tword" style="background:${c}; padding:4px;">EM PAUTA</span>` },
    { id: 'cinema', nome:'Cinema', preview:c=>'<span class="tword" style="font-family:Georgia; font-weight:400;">uma nova história</span>' },
    { id: 'sublinhado', nome:'Sublinhado', preview:c=>`<span class="tword" style="color:${c}; text-decoration:underline;">o que importa</span>` },
    { id: 'duotone', nome:'Duas cores', preview:c=>`<span class="tword">sua <span style="color:${c};">próxima</span> ideia</span>` },
    { id: 'caps-espacado', nome:'Caps espaçado', preview:c=>'<span class="tword" style="letter-spacing:2px;">PRESENÇA</span>' },
    { id: 'pilha', nome:'Pilha compacta', preview:c=>'<span class="tword">UMA IDEIA<br>POR VEZ</span>' },
    { id: 'contorno-colorido', nome:'Contorno colorido', preview:c=>`<span class="tword" style="-webkit-text-stroke:1px ${c};">em destaque</span>` },
    { id: 'sombra-longa', nome:'Sombra longa', preview:c=>'<span class="tword" style="text-shadow:3px 3px #000;">profundidade</span>' }
  ];

  let templateAtual = "caixa-karaoke";

  function init() {
    const saved = App.load('captionTemplate', 'caixa-karaoke');
    templateAtual = TEMPLATES.some(t => t.id === saved) ? saved : 'caixa-karaoke';
    document.getElementById('manchetePainel').style.display = templateAtual === 'manchete' ? 'block' : 'none';
    const savedCount = Number(App.load('headlineWords', 2));
    document.getElementById('manchQtd').textContent = String(Number.isFinite(savedCount) ? Math.max(1, Math.min(6, savedCount)) : 2);
    document.getElementById('legendaTamanhoOut').textContent = `${document.getElementById('legendaTamanho').value}px`;
    atualizarPreview();

    document.getElementById("legendaCor").addEventListener("input", atualizarPreview);
    document.getElementById("legendaTamanho").addEventListener("input", () => {
      document.getElementById("legendaTamanhoOut").textContent = `${document.getElementById("legendaTamanho").value}px`;
      atualizarPreview();
    });
    document.getElementById("legendaFonte").addEventListener("change", atualizarPreview);

    document.getElementById("manchMenos").addEventListener("click", () => ajustarManchQtd(-1));
    document.getElementById("manchMais").addEventListener("click", () => ajustarManchQtd(1));

    document.getElementById("btnGerarLegendas").addEventListener("click", () => App.run('legendasStatus', gerar));
    document.getElementById('importSrt').addEventListener('click', () => App.run('legendasStatus', async () => {
      const file = await PremiereBridge.chooseFile(['srt']);
      if (file) { await PremiereBridge.importMedia(file.path); App.message('legendasStatus', 'SRT importado no painel Projeto. Arraste para a sequência para criar a faixa de legendas.'); }
    }));
    document.getElementById('saveCaptionPreset').addEventListener('click', () => App.run('legendasStatus', async () => {
      CaptionTools.savePreset(options());
    }));
    document.getElementById('loadCaptionPreset').addEventListener('click', () => {
      CaptionTools.loadPreset();
    });
  }

  function renderGrid() {
    const grid = document.getElementById("templateGrid");
    grid.innerHTML = "";
    TEMPLATES.forEach((t) => {
      const card = document.createElement("button");
      card.type = 'button';
      card.setAttribute('aria-label', t.nome);
      card.setAttribute('aria-pressed', String(t.id === templateAtual));
      card.className = "template-card" + (t.id === templateAtual ? " selected" : "");
      card.dataset.id = t.id;
      const cor = document.getElementById("legendaCor")?.value || "#EF9F27";
      card.innerHTML = t.preview(cor) + `<span class="tlabel">${t.nome}</span>`;
      card.addEventListener("click", () => selecionarTemplate(t.id));
      grid.appendChild(card);
    });
  }

  function selecionarTemplate(id) {
    templateAtual = id;
    App.save('captionTemplate', id);
    document.getElementById("manchetePainel").style.display = id === "manchete" ? "block" : "none";
    atualizarPreview();
  }

  function ajustarManchQtd(delta) {
    const el = document.getElementById("manchQtd");
    const novo = Math.min(6, Math.max(1, Number(el.textContent) + delta));
    el.textContent = novo;
    App.save('headlineWords', novo);
    atualizarPreview();
  }

  function atualizarPreview() {
    const cor = document.getElementById("legendaCor").value;
    const tamanho = document.getElementById("legendaTamanho").value;
    const fonte = document.getElementById("legendaFonte").value;
    const t = TEMPLATES.find((x) => x.id === templateAtual);

    const container = document.getElementById('legendaPreview');
    container.innerHTML = t.preview(cor);
    const preview = container.firstElementChild;
    preview.id = 'legendaPreviewTexto';
    preview.style.fontFamily = fonte;
    preview.style.fontSize = `${tamanho}px`;
    if (templateAtual === 'manchete') {
      const words = ['uma', 'ideia', 'pode', 'transformar', 'seu', 'vídeo'];
      const count = Number(document.getElementById('manchQtd').textContent);
      preview.textContent = '';
      preview.style.color = '#ffffff';
      const highlight = document.createElement('span');
      highlight.style.color = cor; highlight.textContent = words.slice(0, count).join(' ');
      preview.appendChild(highlight);
      const rest = document.createElement('span'); rest.textContent = ' ' + words.slice(count).join(' '); preview.appendChild(rest);
    }

    if (typeof CaptionTools !== 'undefined') CaptionTools.updateGuide(container,preview);
    renderGrid();
  }

  function options() {
    return {
      template: templateAtual,
      cor: document.getElementById("legendaCor").value,
      tamanho: Number(document.getElementById("legendaTamanho").value),
      fonte: document.getElementById("legendaFonte").value,
      manchQtd: Number(document.getElementById('manchQtd').textContent),
      animation:App.$('captionAnimation').value,
      position:App.$('captionPosition').value,
      safeTop:App.number('captionSafeTop',0,35), safeBottom:App.number('captionSafeBottom',0,35),
      safeHorizontal:App.number('captionSafeHorizontal',0,35),
      wordsPerLine:App.number('captionWordsPerLine',0,12), maxLines:App.number('captionMaxLines',1,3)
    };
  }
  async function gerar() {
    const result = await Processor.run('transcribe', {path:App.getSource().path,
      language:document.getElementById('captionLanguage').value, style:options(),
      overlay:document.getElementById('captionOverlay').checked,
      layout:document.getElementById('captionLayout').value,
      clicks:document.getElementById('manchSom').checked}, 'legendasStatus');
    await Processor.publish(result, 'legendasStatus');
  }

  function applyOptions(preset) {
    const mapping = {cor:'legendaCor',tamanho:'legendaTamanho',fonte:'legendaFonte',animation:'captionAnimation',position:'captionPosition',
      safeTop:'captionSafeTop',safeBottom:'captionSafeBottom',safeHorizontal:'captionSafeHorizontal',wordsPerLine:'captionWordsPerLine',maxLines:'captionMaxLines'};
    const controls = App.load('controls',{});
    Object.keys(mapping).forEach(key => {
      if (preset[key] !== undefined) { App.$(mapping[key]).value=String(preset[key]); controls[mapping[key]]=String(preset[key]); }
    });
    App.save('controls',controls);
    if (preset.manchQtd) { App.$('manchQtd').textContent=String(preset.manchQtd); App.save('headlineWords',preset.manchQtd); }
    App.$('legendaTamanhoOut').textContent=`${App.$('legendaTamanho').value}px`;
    selecionarTemplate(TEMPLATES.some(t=>t.id===preset.template) ? preset.template : templateAtual);
  }
  return { init, options, applyOptions, refresh:atualizarPreview };
})();
