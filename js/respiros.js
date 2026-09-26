const RespirosTab = (() => {
  let analysis = null;
  function invalidate() { analysis = null; App.$('silenceSegments').textContent = ''; }
  function init() {
    App.onSourceChange(invalidate);
    ['respirosSensibilidade','respirosDuracaoMin','respirosPreservarFala'].forEach(id => App.$(id).addEventListener('input', invalidate));
    App.$('btnDetectarRespiros').addEventListener('click', () => App.run('respirosStatus', async () => {
      invalidate();
      const source = App.getSource();
      analysis = await Processor.run('detect', {path:source.path,
        sensitivity:App.number('respirosSensibilidade',0,100), minDuration:App.number('respirosDuracaoMin',30,2000) / 1000,
        preserveLong:App.$('respirosPreservarFala').checked}, 'respirosStatus');
      const list = App.$('silenceSegments');
      analysis.segments.forEach((segment, index) => {
        const label = App.element('label', undefined, 'checkbox-row');
        const input = document.createElement('input'); input.type = 'checkbox'; input.checked = true; input.value = String(index);
        label.appendChild(input); label.appendChild(App.element('span', `${segment.start.toFixed(2)}–${segment.end.toFixed(2)} s (${(segment.end - segment.start).toFixed(2)} s)`)); list.appendChild(label);
      });
      App.message('respirosStatus', `${analysis.segments.length} intervalos de silêncio. Desmarque os que deseja manter. Os cortes preservam 40 ms nas bordas da fala.`);
    }));
    App.$('btnCortarRespiros').addEventListener('click', () => App.run('respirosStatus', async () => {
      if (!analysis) throw new Error('Analise o arquivo primeiro. Alterar os parâmetros invalida a análise.');
      const indices = Array.from(App.$('silenceSegments').querySelectorAll('input:checked')).map(el => Number(el.value));
      if (!indices.length) throw new Error('Selecione pelo menos um intervalo para remover.');
      const result = await Processor.run('cut', {analysisId:analysis.jobId, indices}, 'respirosStatus');
      invalidate(); await Processor.publish(result, 'respirosStatus');
    }));
  }
  return {init};
})();
