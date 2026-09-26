document.addEventListener("DOMContentLoaded", () => {
  // Navegação entre abas
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // Indica modo de teste local (sem Premiere)
  if (PremiereBridge.isMock) {
    document.getElementById("devBadge").style.display = "inline-block";
  }

  RespirosTab.init();
  VolumeTab.init();
  LegendasTab.init();
  SfxTab.init();
});
