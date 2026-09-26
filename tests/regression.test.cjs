const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');

function panel(extra = {}) {
  const dom = new JSDOM(fs.readFileSync('index.html', 'utf8'), {runScripts:'outside-only', url:'http://localhost'});
  Object.assign(dom.window, extra);
  vm.runInContext(fs.readFileSync('js/core.js','utf8') + '\nwindow.App = App;', dom.getInternalVMContext());
  return dom;
}

test('preview preserves the original template style without duplicate style attributes', () => {
  const dom = panel();
  vm.runInContext(fs.readFileSync('js/legendas.js','utf8') + '\nLegendasTab.init();', dom.getInternalVMContext());
  const d = dom.window.document;
  d.querySelector('[data-id="caixa-destaque"]').click();
  const preview = d.getElementById('legendaPreviewTexto');
  assert.equal(preview.style.background, 'rgb(239, 159, 39)');
  assert.equal(preview.style.fontSize, '14px');
  assert.equal(preview.style.fontFamily, 'Montserrat');
  d.querySelector('[data-id="manchete"]').click();
  d.getElementById('manchMais').click();
  assert.equal(d.getElementById('legendaPreviewTexto').firstChild.textContent, 'uma ideia pode');
  assert.equal(d.querySelectorAll('.template-card').length, 24);
  dom.window.close();
});

test('failure releases busy state and repeated clicks cannot invoke operation twice', async () => {
  const dom = panel(), app = dom.window.App;
  let calls = 0, release;
  const pending = app.run('appStatus', async () => { calls++; await new Promise(r => { release = r; }); throw new Error('Falha de teste'); });
  await app.run('appStatus', async () => { calls++; });
  assert.equal(calls, 1);
  assert.equal(dom.window.document.getElementById('chooseSource').disabled, true);
  release(); await pending;
  assert.equal(app.busy, false);
  assert.equal(dom.window.document.getElementById('chooseSource').disabled, false);
  assert.equal(dom.window.document.getElementById('appStatus').textContent, 'Falha de teste');
  dom.window.close();
});

test('invalid numeric input is rejected before processing', () => {
  const dom = panel();
  dom.window.document.getElementById('respirosDuracaoMin').value = '-1';
  assert.throws(() => dom.window.App.number('respirosDuracaoMin',30,2000));
  dom.window.close();
});

function adapter(host) {
  const context = vm.createContext({require:name => { if (name === 'premierepro' && host) return host; if (name === 'uxp') return {storage:{localFileSystem:{}}}; throw new Error('unavailable'); }});
  vm.runInContext(fs.readFileSync('js/premiere-bridge.js','utf8') + '\nglobalThis.bridge = PremiereBridge;', context);
  return context.bridge;
}

test('MOGRT insertion uses playhead and new tracks and rejects unrelated files', async () => {
  let received;
  const sequence={guid:{toString:()=> 's1'},getPlayerPosition:async()=>({seconds:4}),getVideoTrackCount:async()=>2,getAudioTrackCount:async()=>3};
  const bridge=adapter({Project:{getActiveProject:async()=>({getActiveSequence:async()=>sequence})},SequenceEditor:{getEditor:()=>({insertMogrtFromPath:async(...args)=>{received=args;return [{}];}})}});
  const result=await bridge.applyMogrt('C:/templates/titulo.mogrt');
  assert.equal(received[1].seconds,4);assert.equal(received[2],2);assert.equal(received[3],3);assert.equal(result.track,3);
  await assert.rejects(bridge.applyMogrt('C:/templates/titulo.mp4'),/mogrt/);
});

test('named presets restore composition and SRT rendering does not require a media source', async () => {
  const calls=[];
  const dom=panel({PremiereBridge:{fs:null},Processor:{run:async(...args)=>{calls.push(args);return {};},publish:async()=>{}}});
  vm.runInContext(fs.readFileSync('js/legendas.js','utf8')+'\n'+fs.readFileSync('js/caption-tools.js','utf8')+'\nLegendasTab.init(); CaptionTools.init(); window.captionTools=CaptionTools; window.legendas=LegendasTab;',dom.getInternalVMContext());
  const d=dom.window.document;
  d.getElementById('captionPresetName').value='Meu Reels';
  dom.window.legendas.applyOptions({template:'pilha',animation:'fade',safeBottom:25});
  dom.window.captionTools.savePreset(dom.window.legendas.options());
  dom.window.legendas.applyOptions({template:'classica',animation:'none',safeBottom:10});
  dom.window.captionTools.loadPreset();
  assert.equal(dom.window.legendas.options().template,'pilha');
  assert.equal(d.getElementById('captionAnimation').value,'fade');
  assert.equal(d.querySelector('.safe-guide').style.bottom,'25%');
  d.getElementById('captionSrtText').value='1\n00:00:00,000 --> 00:00:01,000\nTeste';
  d.getElementById('renderSrt').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls[0][0],'renderSrt');assert.equal(calls[0][1].style.template,'pilha');assert.equal(calls[0][1].path,undefined);
  dom.window.close();
});

test('Premiere adapter requires an open project and does not report fake success', async () => {
  const bridge = adapter({Project:{getActiveProject:async () => null}});
  await assert.rejects(bridge.getActiveSequence(), /Abra um projeto/);
});

test('import reuses a matching file and insertion targets a new audio track in a transaction', async () => {
  const calls = [], item = {path:'C:/songs/test.wav'};
  const sequence = {guid:{toString:()=>'sequence-1'}, getPlayerPosition:async()=>({seconds:5}), getAudioTrackCount:async()=>3};
  const p = {getActiveSequence:async()=>sequence, getRootItem:async()=>({getItems:async()=>[item]}),
    importFiles:async()=>{throw new Error('Should reuse existing media');},
    lockedAccess:fn=>fn(), executeTransaction:fn=>{ fn({addAction:a=>calls.push(a)}); return true; }};
  const host = {Project:{getActiveProject:async()=>p}, FolderItem:{cast:()=>null}, ClipProjectItem:{cast:i=>({getMediaFilePath:async()=>i.path})},
    SequenceEditor:{getEditor:()=>({createInsertProjectItemAction:(...args)=>args})}};
  const result = await adapter(host).insertAudio('C:\\songs\\test.wav');
  assert.equal(result.track, 4);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][2], -1); assert.equal(calls[0][3], 3); assert.equal(calls[0][4], true);
});

test('changing the active sequence during import prevents insertion', async () => {
  let current = 'first', inserted = false;
  const sequence = () => ({guid:{toString:()=>current},getPlayerPosition:async()=>({seconds:0})});
  const first = {...sequence(),guid:{toString:()=>'first'}};
  const item = {path:'a.wav'}, entries = [];
  const p = {getActiveSequence:async()=>current === 'first' ? first : {...sequence(),guid:{toString:()=>'second'}},
    getRootItem:async()=>({getItems:async()=>entries}), importFiles:async()=>{entries.push(item); current='second'; return true;}};
  const host={Project:{getActiveProject:async()=>p},FolderItem:{cast:()=>null},ClipProjectItem:{cast:i=>({getMediaFilePath:async()=>i.path})},SequenceEditor:{getEditor:()=>{inserted=true;}}};
  await assert.rejects(adapter(host).insertAudio('a.wav'), /sequência ativa mudou/);
  assert.equal(inserted,false);
});

test('library restores nested folders, deduplicates and filters safely by accented names', async () => {
  const makeFile = (name,path) => ({name,nativePath:path,isFile:true});
  const one = makeFile('Música <b>calma</b>.wav','C:/Sounds/calmo.wav');
  const nested = {name:'Sub',isFolder:true,getEntries:async()=>[one,makeFile('Impacto.mp3','C:/Sounds/Sub/impacto.mp3')]};
  const root = {getEntries:async()=>[one,nested,makeFile('ignored.txt','C:/Sounds/ignored.txt')]};
  const dom = panel({PremiereBridge:{fs:{getEntryForPersistentToken:async()=>root}}});
  dom.window.App.save('folders',[{id:'root',name:'Sounds',path:'C:/Sounds',token:'persistent-token'}]);
  vm.runInContext(fs.readFileSync('js/media-library.js','utf8') + '\nwindow.MediaLibrary=MediaLibrary;',dom.getInternalVMContext());
  await dom.window.MediaLibrary.init();
  const d=dom.window.document;
  assert.equal(d.querySelectorAll('.media-row').length,2);
  assert.equal(d.querySelector('.media-row b'),null);
  const search=d.getElementById('librarySearch'); search.value='musica'; search.dispatchEvent(new dom.window.Event('input'));
  assert.equal(d.querySelectorAll('.media-row').length,1);
  d.querySelector('.media-row [aria-pressed]').click();
  assert.equal(dom.window.App.load('favourites',[]).length,1);
  assert.equal(d.querySelector('.media-row [aria-pressed]').getAttribute('aria-pressed'),'true');
  dom.window.close();
});

test('all browser modules initialize without pretending to connect to Premiere', async () => {
  const dom = new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only',url:'http://localhost'});
  for (const script of dom.window.document.querySelectorAll('script[src]')) {
    vm.runInContext(fs.readFileSync(script.getAttribute('src'),'utf8'),dom.getInternalVMContext());
  }
  await new Promise(r=>setTimeout(r,50));
  const d=dom.window.document;
  assert.equal(d.querySelectorAll('.template-card').length,24);
  assert.equal(d.querySelectorAll('.sfx-item').length,5);
  assert.equal(d.querySelectorAll('.error').length,0);
  assert.match(d.getElementById('devBadge').textContent,/sem edição/);
  dom.window.close();
});

test('multimedia library filters MOGRT and previews its matching sidecar', async () => {
  const names=['titulo.mogrt','titulo.png','musica.wav','overlay.mov'];let previewed;
  const root={getEntries:async()=>names.map(name=>({name,isFile:true,nativePath:'C:/Library/'+name}))};
  const dom=panel({PremiereBridge:{isPremiere:true,fs:{getEntryForPersistentToken:async()=>root},stopPreview:async()=>{},preview:async path=>{previewed=path;}}});
  dom.window.App.save('folders',[{id:'root',name:'Library',path:'C:/Library',token:'token'}]);
  vm.runInContext(fs.readFileSync('js/media-library.js','utf8')+'\nwindow.MediaLibrary=MediaLibrary;',dom.getInternalVMContext());
  await dom.window.MediaLibrary.init();
  const d=dom.window.document,filter=d.getElementById('libraryKind');
  assert.equal(d.querySelectorAll('.media-row').length,4);
  filter.value='mogrt';filter.dispatchEvent(new dom.window.Event('change'));
  assert.equal(d.querySelectorAll('.media-row').length,1);
  assert.match(d.querySelector('.media-row').textContent,/Aplicar MOGRT/);
  await dom.window.MediaLibrary.play({name:'titulo.mogrt',relative:'titulo.mogrt',folderId:'root'});
  assert.equal(previewed,'C:/Library/titulo.png');
  dom.window.close();
});
