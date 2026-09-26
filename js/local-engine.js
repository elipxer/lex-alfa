const LocalEngine = (() => {
  const base = 'http://127.0.0.1:47831';
  let token = null, pending = null, health = null, phase = 'idle', heartbeat = null;
  const listeners = [];
  function report(value, message) {
    phase = value;
    listeners.forEach(fn => fn({phase, message, health}));
  }
  function environment() {
    if (!PremiereBridge.isPremiere) throw new Error('Abra o Lex Alfa pelo menu de plugins do Premiere.');
    const uxp = require('uxp'), os = require('os');
    if (os.platform() !== 'win32') throw new Error('Este instalador é para Windows.');
    const path = os.homedir().replace(/\\/g,'/') + '/AppData/Local/LexAlfa';
    // UXP file URLs accept native spaces; percent encoding can be interpreted literally.
    return {uxp, fs:uxp.storage.localFileSystem, stateUrl:'file:/' + path};
  }
  async function readToken() {
    const {fs,stateUrl} = environment();
    const locations = [() => fs.getEntryWithUrl(stateUrl+'/connection.json'),
      async () => (await fs.getPluginFolder()).getEntry('.runtime/connection.json')];
    for (const get of locations) {
      try {
        const value = JSON.parse(await (await get()).read());
        if (typeof value.token === 'string' && value.token.length >= 32) {token=value.token;return;}
      } catch (_) { /* Try the legacy development location. */ }
    }
    throw new Error('Clique em Ativar Lex Alfa para preparar o painel.');
  }
  async function request(path, body) {
    if (!token) await readToken();
    let timer;
    try {
      const response = await Promise.race([
        fetch(base+path,{method:body === undefined ? 'GET':'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
          ...(body === undefined ? {} : {body:JSON.stringify(body)})}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('O processador demorou a responder. Clique em Reconectar.')),5000);})
      ]);
      const value=await response.json();
      if (!response.ok) {if(response.status===401)token=null;throw new Error(value.error || 'Não foi possível concluir a operação.');}
      return value;
    } catch (error) {
      if (error instanceof TypeError) {token=null;throw new Error('Conexão interrompida. Clique em Reconectar no topo do painel.');}
      throw error;
    } finally {clearTimeout(timer);}
  }
  async function probe() {
    token=null;await readToken();
    const value=await request('/health');
    if(value.app!=='lex-alfa')throw new Error('Resposta local inesperada.');
    return value;
  }
  function ready(value) {
    if(value.version!=='2.1.0')throw new Error('Atualize a instalação do Lex Alfa.');
    if(!value.whisper)throw new Error('A instalação está incompleta. Reinstale o pacote Lex Alfa.');
    health=value;report('ready','Pronto para editar');return health;
  }
  async function start(launch) {
    report('connecting','Conectando ao Lex Alfa…');
    let current;
    try {current=await probe();} catch (_) { /* An offline engine can be launched below. */ }
    if(current?.version==='2.1.0')return ready(current);
    if(!launch) {report('idle','Ative uma vez para começar.');return null;}
    const {uxp,fs}=environment();
    const plugin=await fs.getPluginFolder();
    let executable;
    try {executable=await plugin.getEntry('runtime/LexAlfaEngine.exe');}
    catch (_) {throw new Error('Instale o arquivo Lex-Alfa-2.1.0-Windows.ccx pelo Creative Cloud para ativar o processamento.');}
    if(current) {
      // Authenticated graceful shutdown refuses to stop an active task.
      await request('/shutdown',{});
      await new Promise(resolve=>setTimeout(resolve,800));
    }
    report('connecting','Iniciando o processamento local…');
    const launched=await uxp.shell.openPath(executable.nativePath,'Iniciar o processador local do Lex Alfa, incluído no plugin. Seus vídeos permanecem neste computador.');
    if(launched!=='')throw new Error('A ativação não foi concluída. Clique em Ativar e permita a abertura do Lex Alfa no diálogo do Adobe.');
    for(let attempt=0;attempt<30;attempt++) {
      await new Promise(resolve=>setTimeout(resolve,500));
      try {const value=await probe();if(value.version==='2.1.0')return ready(value);} catch (_) {}
    }
    throw new Error('Não foi possível iniciar o Lex Alfa. Reinstale o pacote ou clique em Reconectar para tentar novamente.');
  }
  function connect(launch=true) {
    if(pending)return pending;
    pending=start(launch).catch(error=>{health=null;report('error',error.message);throw error;}).finally(()=>{pending=null;});
    return pending;
  }
  async function ensure() {
    if(phase==='ready')return health;
    return connect(true);
  }
  async function openOutputs() {
    const value=await ensure(),{uxp}=environment();
    // Worker creates the output directory before publishing health.
    const result=await uxp.shell.openPath(value.outputDir,'Abrir a pasta com os arquivos gerados pelo Lex Alfa.');
    if(result!=='')throw new Error('Não foi possível abrir a pasta de resultados.');
  }
  function observe(fn) {listeners.push(fn);}
  function init() {
    if(!PremiereBridge.isPremiere) {report('preview','Prévia da interface · abra no Premiere para editar');return;}
    connect(App.load('autoConnect',true)).catch(()=>{});
    heartbeat=setInterval(async()=>{
      if(phase!=='ready')return;
      try {await request('/health');} catch (_) {health=null;report('idle','Conexão encerrada. Clique em Reconectar.');}
    },30000);
    window.addEventListener('unload',()=>{clearInterval(heartbeat);});
  }
  return {init,connect,ensure,request,observe,openOutputs,get phase(){return phase;}};
})();
