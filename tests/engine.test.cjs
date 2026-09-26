const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');

function engine({online=false,denied=false}={}) {
  let launches=0,requests=[];
  const token='x'.repeat(48),storage={
    getEntryWithUrl:async url=>{assert.ok(url.startsWith('file:/C:/Users/Teste Nome/AppData/'));return {read:async()=>JSON.stringify({token})};},
    getPluginFolder:async()=>({getEntry:async path=>{assert.equal(path,'runtime/LexAlfaEngine.exe');return {nativePath:'C:/Plugin/runtime/LexAlfaEngine.exe'};}})
  };
  const context=vm.createContext({PremiereBridge:{isPremiere:true},App:{load:()=>false},
    require:name=>name==='os'?{homedir:()=> 'C:\\Users\\Teste Nome',platform:()=> 'win32'}:{storage:{localFileSystem:storage},shell:{openPath:async()=>{launches++;if(!denied)online=true;return denied?'denied':'';}}},
    fetch:async(url,options)=>{requests.push({url,options});if(!online)throw new TypeError('offline');return {ok:true,json:async()=>({app:'lex-alfa',version:'2.0.1',whisper:true,outputDir:'C:/Exports'})};},
    setTimeout:(fn,delay)=>setTimeout(fn,delay===500?0:delay),clearTimeout,setInterval,clearInterval,window:{addEventListener:()=>{}}
  });
  vm.runInContext(fs.readFileSync('js/local-engine.js','utf8')+'\nglobalThis.engine=LocalEngine;',context);
  return {api:context.engine,get launches(){return launches;},requests};
}

test('one activation launches the bundled engine once for concurrent requests',async()=>{
  const e=engine();const phases=[];e.api.observe(value=>phases.push(value.phase));
  const [a,b]=await Promise.all([e.api.ensure(),e.api.ensure()]);
  assert.equal(a.version,'2.0.1');assert.equal(b.version,'2.0.1');assert.equal(e.launches,1);
  assert.equal(phases.at(-1),'ready');
  assert.ok(e.requests.every(r=>r.options.headers.Authorization==='Bearer '+'x'.repeat(48)));
});

test('connecting to a running engine never launches another process',async()=>{
  const e=engine({online:true});await e.api.connect(false);assert.equal(e.launches,0);assert.equal(e.api.phase,'ready');
});

test('Adobe launch denial is recoverable and never reports ready',async()=>{
  const e=engine({denied:true});await assert.rejects(e.api.ensure(),/ativação não foi concluída/);
  assert.equal(e.api.phase,'error');assert.equal(e.launches,1);
});

test('panel starts with collapsed advanced controls and preserves keyboard navigation',async()=>{
  const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'http://localhost'});
  for(const script of dom.window.document.querySelectorAll('script[src]'))vm.runInContext(fs.readFileSync(script.getAttribute('src'),'utf8'),dom.getInternalVMContext());
  await new Promise(resolve=>setTimeout(resolve,40));
  const d=dom.window.document;
  assert.equal(d.getElementById('captionComposition').hidden,true);
  d.querySelector('[aria-controls="captionComposition"]').click();
  assert.equal(d.getElementById('captionComposition').hidden,false);
  const first=d.getElementById('nav-biblioteca');first.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  assert.equal(d.getElementById('nav-respiros').getAttribute('aria-selected'),'true');
  assert.equal(d.getElementById('tab-respiros').hidden,false);
  assert.equal(d.getElementById('activateEngine').disabled,true);
  assert.equal(d.querySelectorAll('#legendaPreview').length,1);
  assert.equal(d.querySelector('#tab-legendas #captionAppearance #legendaFonte')?.id,'legendaFonte');
  dom.window.close();
});
