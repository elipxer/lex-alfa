const VolumeTab = (() => {
  function init() {
    const alvo = document.getElementById("volumeAlvo");
    const alvoOut = document.getElementById("volumeAlvoOut");
    const lim = document.getElementById("volumeLimitador");
    const limOut = document.getElementById("volumeLimitadorOut");

    alvo.addEventListener("input", () => (alvoOut.textContent = `${alvo.value} LUFS`));
    lim.addEventListener("input", () => (limOut.textContent = `${lim.value} dB`));

    document.getElementById("btnAplicarVolume").addEventListener("click", aplicar);
  }

  async function aplicar() {
    const status = document.getElementById("volumeStatus");
    status.textContent = "Nivelando áudio...";
    const targetLufs = Number(document.getElementById("volumeAlvo").value);
    const limiterDb = Number(document.getElementById("volumeLimitador").value);
    const autoNivelar = document.getElementById("volumeAutoNivelar").checked;

    const res = await PremiereBridge.normalizeAudio({ targetLufs, limiterDb, autoNivelar });
    status.textContent = `Volume nivelado (${res.targetLufs} LUFS, limitador ${res.limiterDb} dB) em ${res.aplicadoEm}.`;
  }

  return { init };
})();
