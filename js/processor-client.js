const Processor = (() => {
  let activeJob = null;
  const request = (path,body) => LocalEngine.request(path,body);
  async function check() {
    const result = await LocalEngine.connect(true);
    App.message('processorStatus', 'Tudo pronto. Escolha um arquivo e uma ferramenta.');
    return result;
  }
  async function run(operation, options, statusId) {
    App.message('processorStatus','Preparando tarefa…');
    try {
      await LocalEngine.ensure();
      const started = await request('/jobs', {operation, ...options});
      activeJob = started.id; App.$('cancelProcessing').disabled = false;
      while (true) {
        const job = await request(`/jobs/${started.id}`);
        const message=job.message || 'Processando…';
        App.message(statusId,message);App.message('processorStatus',message);
        if (job.state === 'done') {
          App.message('processorStatus',operation==='detect'?'Análise concluída. Revise os intervalos em Cortes.':'Tarefa concluída.');
          return {...job.result, jobId:started.id};
        }
        if (job.state === 'error' || job.state === 'cancelled') throw new Error(job.error || 'Operação cancelada.');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch(error) {App.message('processorStatus',error.message || String(error),true);throw error;}
    finally { activeJob = null; App.$('cancelProcessing').disabled = true; }
  }
  async function cancel() { if (activeJob) {await request(`/jobs/${activeJob}/cancel`, {});App.message('processorStatus','Cancelamento solicitado…');App.$('cancelProcessing').disabled=true;} }
  async function publish(result, statusId) {
    const files = result.files || [];
    const previous = App.load('outputs', []);
    const allFiles = Array.from(new Set([...files, ...(Array.isArray(previous) ? previous : [])])).slice(0, 20);
    App.save('outputs', allFiles); renderOutputs(allFiles);
    const message=(result.message || `${files.length} arquivo(s) gerado(s).`).replace(/Importe os resultados abaixo/gi,'Importe pela aba Resultados').replace(/Importe o resultado abaixo/gi,'Importe pela aba Resultados').replace(/Use Importar no projeto abaixo/gi,'Use a aba Resultados');
    App.message(statusId,message);
    App.message('processorStatus',`${files.length} arquivo(s) pronto(s). Abra Resultados para importar.`);
  }
  function renderOutputs(files) {
    const out = App.$('outputFiles'); out.textContent = '';
    App.$('showResults').textContent=`Resultados (${files.length})`;
    if (!files.length) out.appendChild(App.element('p', 'Nenhum arquivo gerado ainda. Use Cortes, Volume ou Legendas para criar seu primeiro resultado.', 'hint'));
    files.forEach(path => {
      const row = App.element('div', undefined, 'output-row');
      const parts=path.split(/[\\/]/),name=parts.pop();
      const info=App.element('div',undefined,'output-info');
      const label=App.element('strong',name);label.title=path;info.appendChild(label);
      info.appendChild(App.element('span',parts.pop() || '', 'output-meta'));row.appendChild(info);
      const button = App.button('Importar no projeto', () => App.run('appStatus', async () => {
        await PremiereBridge.importMedia(path); App.message('appStatus', 'Arquivo importado no projeto.');
      }));
      button.setAttribute('aria-label',`Importar ${name} no projeto`);
      button.setAttribute('data-operation', ''); row.appendChild(button); out.appendChild(row);
    });
  }
  function restoreOutputs() {
    const saved = App.load('outputs', []);
    renderOutputs(Array.isArray(saved) ? saved.filter(p => typeof p === 'string').slice(0,20) : []);
  }
  return {check, run, cancel, publish, restoreOutputs};
})();
