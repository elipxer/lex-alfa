const RespirosTab = (() => {
  let ultimosSegmentos = [];

  function init() {
    document.getElementById("btnDetectarRespiros").addEventListener("click", detectar);
    document.getElementById("btnCortarRespiros").addEventListener("click", cortar);
  }

  async function detectar() {
    const status = document.getElementById("respirosStatus");
    status.textContent = "Detectando respiros na timeline...";
    const sensibilidade = Number(document.getElementById("respirosSensibilidade").value);
    const duracaoMinMs = Number(document.getElementById("respirosDuracaoMin").value);
    const preservarFala = document.getElementById("respirosPreservarFala").checked;

    const { segments } = await PremiereBridge.detectSilences({ sensibilidade, duracaoMinMs, preservarFala });
    ultimosSegmentos = segments;
    status.textContent = `${segments.length} respiros detectados. Clique em "Cortar" pra aplicar.`;
  }

  async function cortar() {
    const status = document.getElementById("respirosStatus");
    if (!ultimosSegmentos.length) {
      status.textContent = "Detecte os respiros primeiro.";
      return;
    }
    status.textContent = "Cortando...";
    const { cortados } = await PremiereBridge.cutSilences(ultimosSegmentos);
    status.textContent = `${cortados} respiros cortados da timeline.`;
    ultimosSegmentos = [];
  }

  return { init };
})();
