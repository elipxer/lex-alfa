const Processor = (() => {
  let activeJob = null;
  const request = (path,body) => LocalEngine.request(path,body);
  async function check() {
    const result = await LocalEngine.connect(true);
    App.message('processorStatus', 'Tudo pronto. Escolha um arquivo e uma ferramenta.');
    return result;
  }
  async function run(operation, options, statusId) {
    await LocalEngine.ensure();
    const started = await request('/jobs', {operation, ...options});
    activeJob = started.id; App.$('cancelProcessing').disabled = false;
    try {
      while (true) {
        const job = await request(`/jobs/${started.id}`);
        App.message(statusId, job.message || 'Processando...');
        if (job.state === 'done') return {...job.result, jobId:started.id};
        if (job.state === 'error' || job.state === 'cancelled') throw new Error(job.error || 'Operação cancelada.');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally { activeJob = null; App.$('cancelProcessing').disabled = true; }
  }
  async function cancel() { if (activeJob) await request(`/jobs/${activeJob}/cancel`, {}); }
  async function publish(result, statusId) {
    const files = result.files || [];
    const previous = App.load('outputs', []);
    const allFiles = Array.from(new Set([...files, ...(Array.isArray(previous) ? previous : [])])).slice(0, 20);
    App.save('outputs', allFiles); renderOutputs(allFiles);
    App.message(statusId, result.message || `${files.length} arquivo(s) gerado(s). Use Importar no projeto abaixo.`);
  }
  function renderOutputs(files) {
    const out = App.$('outputFiles'); out.textContent = '';
    if (!files.length) out.appendChild(App.element('p', 'Os arquivos gerados aparecem aqui, prontos para importar no projeto.', 'hint'));
    files.forEach(path => {
      const row = App.element('div', undefined, 'output-row');
      const label=App.element('span',path.split(/[\\/]/).pop());label.title=path;row.appendChild(label);
      const button = App.button('Importar no projeto', () => App.run('appStatus', async () => {
        await PremiereBridge.importMedia(path); App.message('appStatus', 'Arquivo importado no projeto.');
      }));
      button.setAttribute('data-operation', ''); row.appendChild(button); out.appendChild(row);
    });
  }
  function restoreOutputs() {
    const saved = App.load('outputs', []);
    renderOutputs(Array.isArray(saved) ? saved.filter(p => typeof p === 'string').slice(0,20) : []);
  }
  return {check, run, cancel, publish, restoreOutputs};
})();
