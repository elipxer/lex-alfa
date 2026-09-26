const VolumeTab = (() => {
  function init() {
    const update = () => {
      App.$('volumeAlvoOut').textContent = `${App.$('volumeAlvo').value} LUFS`;
      App.$('volumeLimitadorOut').textContent = `${App.$('volumeLimitador').value} dBTP`;
    };
    ['volumeAlvo','volumeLimitador'].forEach(id => App.$(id).addEventListener('input', update)); update();
    App.$('btnAplicarVolume').addEventListener('click', () => App.run('volumeStatus', async () => {
      const result = await Processor.run('normalize', {path:App.getSource().path,
        targetLufs:App.number('volumeAlvo',-30,-6), limiterDb:App.number('volumeLimitador',-6,0)}, 'volumeStatus');
      await Processor.publish(result, 'volumeStatus');
    }));
  }
  return {init};
})();
