document.addEventListener('DOMContentLoaded', async () => {
  App.bindPreferences();
  const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
  function select(id) {
    tabButtons.forEach(btn => { const active = btn.dataset.tab === id; btn.classList.toggle('active', active); btn.setAttribute('aria-selected', String(active));btn.tabIndex=active?0:-1; });
    document.querySelectorAll('.tab-pane').forEach(p => {const active=p.id===`tab-${id}`;p.classList.toggle('active',active);p.hidden=!active;});
    App.$('sourceCard').hidden = !['respiros','volume','legendas'].includes(id);
    document.querySelector('.workspace-body').scrollTop = 0;
    App.save('activeTab', id);
  }
  tabButtons.forEach(btn => btn.addEventListener('click', () => select(btn.dataset.tab)));
  const lastTab = App.load('activeTab', 'legendas');
  select(tabButtons.some(b => b.dataset.tab === lastTab) ? lastTab : 'legendas');
  App.$('showResults').addEventListener('click', () => { select('resultados'); App.$('nav-resultados').focus(); });
  App.$('devBadge').textContent = PremiereBridge.isPremiere ? 'Premiere conectado' : 'Prévia no navegador · sem edição';
  App.$('devBadge').style.display = 'inline-block';
  App.$('chooseSource').addEventListener('click', () => App.run('appStatus', async () => {
    const source = await PremiereBridge.chooseFile(); if (source) App.setSource(source);
  }));
  App.$('selectedSource').addEventListener('click', () => App.run('appStatus', async () => App.setSource(await PremiereBridge.selectedSource())));
  App.$('checkProcessor').addEventListener('click', () => App.run('processorStatus', Processor.check));
  App.$('cancelProcessing').addEventListener('click', () => Processor.cancel().catch(e => App.message('processorStatus', e.message, true)));
  [RespirosTab, VolumeTab, LegendasTab, CaptionTools, SfxTab].forEach(tab => {
    try { tab.init(); } catch (e) { App.message('appStatus', `Erro ao iniciar painel: ${e.message}`, true); }
  });
  Processor.restoreOutputs();
  PanelUI.init();
  await MediaLibrary.init();
});
