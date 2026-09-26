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
    { id: "caixa-karaoke", nome: "Caixa karaokê", preview: (c) => `<span class="tword">isso <span style="background:${c}; color:#111; padding:2px 6px; border-radius:4px;">funciona</span> bem</span>` }
  ];

  let templateAtual = "caixa-karaoke";

  function init() {
    renderGrid();
    atualizarPreview();

    document.getElementById("legendaCor").addEventListener("input", atualizarPreview);
    document.getElementById("legendaTamanho").addEventListener("input", () => {
      document.getElementById("legendaTamanhoOut").textContent = `${document.getElementById("legendaTamanho").value}px`;
      atualizarPreview();
    });
    document.getElementById("legendaFonte").addEventListener("change", atualizarPreview);

    document.getElementById("manchMenos").addEventListener("click", () => ajustarManchQtd(-1));
    document.getElementById("manchMais").addEventListener("click", () => ajustarManchQtd(1));

    document.getElementById("btnGerarLegendas").addEventListener("click", gerar);
  }

  function renderGrid() {
    const grid = document.getElementById("templateGrid");
    grid.innerHTML = "";
    TEMPLATES.forEach((t) => {
      const card = document.createElement("div");
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
    document.getElementById("manchetePainel").style.display = id === "manchete" ? "block" : "none";
    renderGrid();
    atualizarPreview();
  }

  function ajustarManchQtd(delta) {
    const el = document.getElementById("manchQtd");
    const novo = Math.min(6, Math.max(1, Number(el.textContent) + delta));
    el.textContent = novo;
  }

  function atualizarPreview() {
    const cor = document.getElementById("legendaCor").value;
    const tamanho = document.getElementById("legendaTamanho").value;
    const fonte = document.getElementById("legendaFonte").value;
    const t = TEMPLATES.find((x) => x.id === templateAtual);

    const preview = document.getElementById("legendaPreviewTexto");
    preview.outerHTML = t.preview(cor).replace(
      'class="tword"',
      `class="tword" id="legendaPreviewTexto" style="font-family:'${fonte}'; font-size:${tamanho}px;"`
    );

    renderGrid();
  }

  async function gerar() {
    const status = document.getElementById("legendasStatus");
    status.textContent = "Gerando legendas automáticas...";

    const payload = {
      template: templateAtual,
      cor: document.getElementById("legendaCor").value,
      tamanho: Number(document.getElementById("legendaTamanho").value),
      fonte: document.getElementById("legendaFonte").value
    };

    if (templateAtual === "manchete") {
      payload.manchQtd = Number(document.getElementById("manchQtd").textContent);
      payload.manchSom = document.getElementById("manchSom").checked;
      if (payload.manchSom) await PremiereBridge.playPreview("clique");
    }

    const res = await PremiereBridge.generateCaptions(payload);
    status.textContent = `${res.legendasGeradas} legendas geradas com o template "${TEMPLATES.find((t) => t.id === templateAtual).nome}".`;
  }

  return { init };
})();
