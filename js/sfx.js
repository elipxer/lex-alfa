const SfxTab = (() => {
  function init() {
    const list = App.$('sfxList'); list.textContent = '';
    [['clique','Clique'],['whoosh','Whoosh'],['pop','Pop'],['ding','Ding'],['impacto','Impacto']].forEach(([id,name]) => {
      const row = App.element('div', undefined, 'sfx-item'); row.appendChild(App.element('span', name));
      const actions = App.element('div', undefined, 'actions');
      [['Ouvir', async () => { await MediaLibrary.play({path:await PremiereBridge.bundledSfx(id),name}); App.message('sfxStatus', `Prévia: ${name}.`); }],
       ['Adicionar em nova faixa', async () => { const result = await PremiereBridge.insertAudio(await PremiereBridge.bundledSfx(id)); App.message('sfxStatus', `${name} adicionado na faixa A${result.track}.`); }]
      ].forEach(([label,fn]) => { const button = App.button(label, () => App.run('sfxStatus', fn)); button.setAttribute('data-operation',''); actions.appendChild(button); });
      row.appendChild(actions); list.appendChild(row);
    });
    App.$('stopSfx').addEventListener('click', () => MediaLibrary.stop().catch(e => App.message('sfxStatus', e.message, true)));
  }
  return {init};
})();
