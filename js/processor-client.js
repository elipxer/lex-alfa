const Processor = (() => {
  const base = 'http://127.0.0.1:47831';
  let token = null, activeJob = null;
  async function connection() {
    if (token) return;
    const fs = PremiereBridge.fs;
    if (!fs) throw new Error('Processamento local disponível no painel do Premiere.');
    try {
      const file = await (await fs.getPluginFolder()).getEntry('.runtime/connection.json');
      const value = JSON.parse(await file.read());
      if (typeof value.token !== 'string' || value.token.length < 32) throw new Error('Conexão inválida.');
      token = value.token;
    } catch (_) { throw new Error('Inicie o processador com Iniciar-LexAlfa.ps1 na pasta do plugin.'); }
  }
  async function request(path, body) {
    await connection();
    let response;
    try {
      response = await fetch(base + path, {method:body === undefined ? 'GET' : 'POST',
        headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    } catch (_) { token = null; throw new Error('Processador local desconectado. Execute Iniciar-LexAlfa.ps1 e tente novamente.'); }
    const result = await response.json();
    if (!response.ok) { if (response.status === 401) token = null; throw new Error(result.error || 'Falha no processador.'); }
    return result;
  }
  async function check() {
    const result = await request('/health');
    App.message('processorStatus', `FFmpeg conectado · transcrição ${result.whisper ? 'pronta' : 'requer modelo Whisper'}`);
    return result;
  }
  async function run(operation, options, statusId) {
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
    const files = result.files || [], out = App.$('outputFiles'); out.textContent = '';
    files.forEach(path => {
      const row = App.element('div', undefined, 'output-row'); row.appendChild(App.element('span', path));
      const button = App.button('Importar no projeto', () => App.run('appStatus', async () => {
        await PremiereBridge.importMedia(path); App.message('appStatus', 'Arquivo importado no projeto.');
      }));
      button.setAttribute('data-operation', ''); row.appendChild(button); out.appendChild(row);
    });
    App.message(statusId, result.message || `${files.length} arquivo(s) gerado(s). Use Importar no projeto abaixo.`);
  }
  return {check, run, cancel, publish};
})();
