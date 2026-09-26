/**
 * dev-mock.js
 * Simula respostas do Premiere Pro para testar o painel no navegador
 * (VS Code Live Server) sem precisar abrir o Premiere.
 * Ativa sozinho quando `require("premierepro")` falha.
 */
window.DevMock = {
  async getActiveSequence() {
    return { id: "mock-seq-1", name: "Sequência de teste", durationSec: 128 };
  },

  async detectSilences({ sensibilidade, duracaoMinMs, preservarFala }) {
    await wait(500);
    const qtd = Math.max(3, Math.round((sensibilidade / 100) * 14));
    const segments = Array.from({ length: qtd }, (_, i) => ({
      start: i * 6 + 1.2,
      end: i * 6 + 1.2 + duracaoMinMs / 1000
    }));
    return { segments, preservarFala };
  },

  async cutSilences(segments) {
    await wait(400);
    return { cortados: segments.length };
  },

  async normalizeAudio({ targetLufs, limiterDb, autoNivelar }) {
    await wait(400);
    return { aplicadoEm: autoNivelar ? "todos os clipes" : "clipe selecionado", targetLufs, limiterDb };
  },

  async generateCaptions({ template, cor, tamanho, fonte, manchQtd, manchSom }) {
    await wait(600);
    return { template, cor, tamanho, fonte, manchQtd, manchSom, legendasGeradas: 42 };
  },

  async insertSfxAtPlayhead(sfxId) {
    await wait(150);
    return { inserido: sfxId };
  },

  async playPreview(sfxId) {
    // No modo mock, toca um beep sintetizado via Web Audio API
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = { clique: 1200, whoosh: 300, pop: 700, ding: 1500, impacto: 90 }[sfxId] || 600;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) { /* silencioso */ }
    return { tocado: sfxId };
  }
};

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
