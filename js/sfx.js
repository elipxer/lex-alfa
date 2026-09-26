const SfxTab = (() => {
  const SONS = [
    { id: "clique", nome: "Clique" },
    { id: "whoosh", nome: "Whoosh" },
    { id: "pop", nome: "Pop" },
    { id: "ding", nome: "Ding" },
    { id: "impacto", nome: "Impacto" }
  ];

  function init() {
    const list = document.getElementById("sfxList");
    list.innerHTML = "";
    SONS.forEach((s) => {
      const item = document.createElement("div");
      item.className = "sfx-item";
      item.innerHTML = `
        <span>${s.nome}</span>
        <span>
          <button data-action="preview" data-id="${s.id}">Ouvir</button>
          <button data-action="inserir" data-id="${s.id}">Inserir no playhead</button>
        </span>
      `;
      list.appendChild(item);
    });

    list.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const id = btn.dataset.id;
      const status = document.getElementById("sfxStatus");
      if (btn.dataset.action === "preview") {
        await PremiereBridge.playPreview(id);
      } else {
        status.textContent = "Inserindo...";
        await PremiereBridge.insertSfxAtPlayhead(id);
        status.textContent = `"${id}" inserido no playhead da timeline.`;
      }
    });
  }

  return { init };
})();
