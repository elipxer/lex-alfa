const MediaLibrary = (() => {
  const audioExtensions = ['wav','mp3','aif','aiff','m4a','aac','flac','ogg','wma'];
  const extensions = [...audioExtensions,'mogrt','mp4','mov','webm','avi','png','jpg','jpeg','webp'];
  const kind = name => {
    const ext = name.split('.').pop().toLowerCase();
    return ext === 'mogrt' ? 'mogrt' : audioExtensions.includes(ext) ? 'audio' : ['png','jpg','jpeg','webp'].includes(ext) ? 'image' : 'video';
  };
  const supported = name => extensions.includes(name.split('.').pop().toLowerCase());
  const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let folders = [], files = [], favourites = new Set(), visibleLimit = 100;
  let audio = null, objectUrl = null, scanning = false, cancelled = false;
  function persist() {
    App.save('folders', folders.filter(f => f.token).map(({id,name,path,token}) => ({id,name,path,token})));
    App.save('favourites', Array.from(favourites));
  }
  function key(path) { return path.replace(/\\/g, '/').toLowerCase(); }
  async function restore() {
    const saved = App.load('folders', []), favs = App.load('favourites', []);
    favourites = new Set(Array.isArray(favs) ? favs.filter(v => typeof v === 'string') : []);
    if (PremiereBridge.fs && Array.isArray(saved)) {
      for (const f of saved) {
        if (!f || typeof f.token !== 'string') continue;
        try { folders.push({...f, entry:await PremiereBridge.fs.getEntryForPersistentToken(f.token)}); }
        catch (_) { folders.push({...f, error:'Pasta indisponível. Remova e adicione novamente.'}); }
      }
    }
    await refresh();
  }
  async function addFolder() {
    if (!PremiereBridge.fs) { App.$('browserFolder').click(); return; }
    await App.run('libraryStatus', async () => {
      const entry = await PremiereBridge.fs.getFolder();
      if (!entry) return;
      const id = key(entry.nativePath);
      if (folders.some(f => f.id === id)) { App.message('libraryStatus', 'Esta pasta já está na biblioteca.'); return; }
      const token = await PremiereBridge.fs.createPersistentToken(entry);
      folders.push({id, name:entry.name, path:entry.nativePath, token, entry});
      persist(); await refresh();
    });
  }
  function renderFolders() {
    const list = App.$('libraryFolders'); list.textContent = '';
    folders.forEach(f => {
      const row = App.element('div', undefined, 'folder-row');
      row.appendChild(App.element('span', `${f.name}${f.error ? ' — ' + f.error : ''}`));
      row.title = f.path || f.name;
      const remove = App.button('Remover da lista', () => App.run('libraryStatus', async () => {
        folders = folders.filter(x => x.id !== f.id); persist(); await refresh();
      }));
      remove.setAttribute('data-operation', ''); row.appendChild(remove); list.appendChild(row);
    });
  }
  async function refresh() {
    if (scanning) return;
    scanning = true; cancelled = false;
    App.$('cancelScan').disabled = false;
    const next = new Map(), warnings = [];
    let visited = 0, limited = false;
    const recursive = App.$('libraryRecursive').checked;
    async function walk(entry, root, relative = '', depth = 0) {
      if (cancelled || limited) return;
      if (depth > 32 || visited++ > 20000 || next.size >= 10000) { limited = true; return; }
      let entries;
      try { entries = await entry.getEntries(); }
      catch (_) { warnings.push(relative || root.name); return; }
      for (const item of entries) {
        if (cancelled || limited) break;
        if (next.size >= 10000) { limited = true; break; }
        const rel = relative ? `${relative}/${item.name}` : item.name;
        if (item.isFolder && recursive) await walk(item, root, rel, depth + 1);
        else if (item.isFile && supported(item.name)) {
          const id = key(item.nativePath);
          next.set(id, {id, name:item.name, path:item.nativePath, relative:rel, folder:root.name, folderId:root.id, entry:item});
        }
      }
      if (visited % 20 === 0) { App.message('libraryStatus', `Localizando arquivos… ${next.size}`); await new Promise(r => setTimeout(r, 0)); }
    }
    try {
      for (const folder of folders) {
        if (cancelled || limited) break;
        if (folder.error) { warnings.push(folder.name); continue; }
        if (folder.builtinFiles) {
          folder.builtinFiles.forEach(f=>next.set(f.path,{id:f.path,name:f.name,path:f.path,relative:f.name,folder:folder.name,folderId:folder.id}));
        } else if (folder.browserFiles) {
          for (const file of folder.browserFiles) {
            if (next.size >= 10000) { limited = true; break; }
            const rel = file.webkitRelativePath || file.name;
            if (supported(file.name) && (recursive || rel.split('/').length <= 2)) {
              const id = `browser:${rel}`;
              next.set(id, {id, name:file.name, file, relative:rel, folder:folder.name, folderId:folder.id});
            }
          }
        } else await walk(folder.entry, folder);
      }
      files = Array.from(next.values()).sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
      visibleLimit = 100; renderFolders(); render();
      App.message('libraryStatus', `${files.length} arquivo(s) localizado(s).${cancelled ? ' Busca interrompida; lista parcial.' : ''}${limited ? ' Limite de busca atingido; escolha pastas menores.' : ''}${warnings.length ? ` ${warnings.length} pasta(s) sem acesso.` : ''}`);
    } finally { scanning = false; App.$('cancelScan').disabled = true; }
  }
  function filtered() {
    const query = normalize(App.$('librarySearch').value).trim().split(/\s+/).filter(Boolean);
    const type = App.$('libraryFormat').value, onlyFav = App.$('libraryFavourites').checked;
    const category = App.$('libraryKind').value;
    return files.filter(f => query.every(q => normalize(`${f.name} ${f.relative} ${f.folder}`).includes(q)) &&
      (!category || kind(f.name) === category) && (!type || f.name.toLowerCase().endsWith('.' + type)) && (!onlyFav || favourites.has(f.id)));
  }
  async function stop() {
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (App.$('assetPreview')) App.$('assetPreview').textContent='';
    await PremiereBridge.stopPreview();
  }
  async function play(file) {
    await stop();
    if (kind(file.name) === 'mogrt') {
      const base = file.relative.replace(/\.mogrt$/i, '').toLowerCase();
      const sidecar = files.find(f => f.folderId === file.folderId && f.relative.replace(/\.[^.]+$/, '').toLowerCase() === base && ['video','image'].includes(kind(f.name)));
      if (!sidecar) throw new Error('Para a prévia do MOGRT, coloque um MP4 ou PNG com o mesmo nome na mesma pasta.');
      return play(sidecar);
    }
    if (PremiereBridge.isPremiere) {
      await PremiereBridge.preview(file.path);
      App.message('libraryStatus', `Prévia de ${file.name} no monitor de origem.`);
    } else {
      const previewBox = App.$('assetPreview'); previewBox.textContent = '';
      if (kind(file.name) === 'image') {
        const img = document.createElement('img'); if(file.file)objectUrl = URL.createObjectURL(file.file); img.src = objectUrl || file.path; img.alt = file.name; previewBox.appendChild(img); return;
      }
      audio = document.createElement(kind(file.name) === 'video' ? 'video' : 'audio');
      audio.controls = true; previewBox.appendChild(audio);
      if (file.file) { objectUrl = URL.createObjectURL(file.file); audio.src = objectUrl; }
      else audio.src = file.path;
      audio.volume = 0.5;
      audio.onended = () => { stop().catch(() => {}); };
      try { await audio.play(); } catch (_) { await stop(); throw new Error('O navegador não conseguiu reproduzir este formato. Abra no Premiere.'); }
      App.message('libraryStatus', `Reproduzindo ${file.name}.`);
    }
  }
  function render() {
    const result = filtered(), list = App.$('libraryFiles'); list.textContent = '';
    App.$('libraryCount').textContent = `${result.length} resultado(s)`;
    if (!result.length) list.appendChild(App.element('p', folders.length ? 'Nenhum arquivo corresponde aos filtros.' : 'Adicione pastas de áudio, overlays ou MOGRT para começar.', 'hint'));
    result.slice(0, visibleLimit).forEach(file => {
      const row = App.element('div', undefined, 'media-row');
      const heading = App.element('div', undefined, 'row-between');
      heading.appendChild(App.element('strong', file.name));
      const favourite = App.button(favourites.has(file.id) ? '★' : '☆', () => {
        if (favourites.has(file.id)) favourites.delete(file.id); else favourites.add(file.id);
        persist(); render();
      });
      favourite.setAttribute('aria-label', `Favorito: ${file.name}`);
      favourite.setAttribute('aria-pressed', String(favourites.has(file.id)));
      heading.appendChild(favourite); row.appendChild(heading);
      row.appendChild(App.element('p', `${file.folder} / ${file.relative}`, 'media-path'));
      const actions = App.element('div', undefined, 'actions');
      const action = (label, fn) => {
        const btn = App.button(label, () => App.run('libraryStatus', fn));
        btn.setAttribute('data-operation', ''); actions.appendChild(btn);
      };
      const category = kind(file.name);
      action(category === 'audio' ? 'Ouvir' : 'Prévia', () => play(file));
      if (category === 'mogrt') action('Aplicar MOGRT', async () => {
        const result = await PremiereBridge.applyMogrt(file.path);
        App.message('libraryStatus', `${file.name} aplicado na faixa V${result.track}. Edite o texto e parâmetros no painel de propriedades do Premiere.`);
      });
      else action('Importar', async () => { await PremiereBridge.importMedia(file.path); App.message('libraryStatus', `${file.name} importado no projeto.${category === 'audio' ? '' : ' Posicione em uma faixa acima da imagem.'}`); });
      if (category === 'audio') action('Adicionar em nova faixa', async () => {
        const result = await PremiereBridge.insertAudio(file.path || '');
        App.message('libraryStatus', `${file.name} adicionado na faixa A${result.track}, em ${result.seconds.toFixed(2)} s.`);
      });
      if (category === 'audio' || category === 'video') action('Processar', async () => { if (!file.path) throw new Error('Abra o painel no Premiere para processar arquivos.'); App.setSource(file); App.message('libraryStatus', 'Arquivo selecionado. Abra Respiros, Volume ou Legendas.'); });
      row.appendChild(actions); list.appendChild(row);
    });
    App.$('libraryMore').style.display = result.length > visibleLimit ? 'block' : 'none';
  }
  function init() {
    App.$('addBundledOverlays').addEventListener('click',()=>App.run('libraryStatus',async()=>{
      if(PremiereBridge.fs){
        const entry=await PremiereBridge.bundledOverlayFolder(),id=key(entry.nativePath);
        if(!folders.some(f=>f.id===id))folders.push({id,name:'Overlays Lex Alfa',path:entry.nativePath,entry,token:await PremiereBridge.fs.createPersistentToken(entry)});
        persist();
      } else if(!folders.some(f=>f.id==='builtin-overlays')) folders.push({id:'builtin-overlays',name:'Overlays Lex Alfa',builtinFiles:['grao','vinheta','luz-quente','linhas'].map(name=>({name:name+'.png',path:`assets/overlays/${name}.png`}))});
      await refresh();
    }));
    App.$('addLibraryFolder').addEventListener('click', addFolder);
    App.$('refreshLibrary').addEventListener('click', () => App.run('libraryStatus', refresh));
    App.$('cancelScan').addEventListener('click', () => { cancelled = true; });
    App.$('stopPreview').addEventListener('click', () => stop().catch(e => App.message('libraryStatus', e.message, true)));
    ['librarySearch','libraryFormat','libraryKind','libraryFavourites'].forEach(id => App.$(id).addEventListener(id === 'librarySearch' ? 'input' : 'change', () => { visibleLimit = 100; render(); }));
    App.$('libraryRecursive').addEventListener('change', () => App.run('libraryStatus', refresh));
    App.$('libraryMore').addEventListener('click', () => { visibleLimit += 100; render(); });
    App.$('browserFolder').addEventListener('change', e => App.run('libraryStatus', async () => {
      const items = Array.from(e.target.files || []); if (!items.length) return;
      const name = (items[0].webkitRelativePath || 'Pasta local').split('/')[0], id = `browser:${name}`;
      folders = folders.filter(f => f.id !== id);
      folders.push({id, name, browserFiles:items}); await refresh();
      App.message('libraryStatus', `${files.length} arquivos. No navegador, selecione novamente a pasta após recarregar.`);
      e.target.value = '';
    }));
    return App.run('libraryStatus', restore);
  }
  return {init, play, stop};
})();
