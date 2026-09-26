/* UXP adapter: browser mode never pretends to edit a project. */
const PremiereBridge = (() => {
  let ppro = null, uxp = null, hostError = null;
  if (typeof require === 'function') {
    try { uxp = require('uxp'); } catch (_) { /* Browser. */ }
    try { ppro = require('premierepro'); } catch (e) { if (uxp) hostError = e; }
  }
  const fs = uxp && uxp.storage.localFileSystem;
  const pathKey = path => path.replace(/\\/g, '/').toLowerCase();
  function requireHost() {
    if (!ppro) throw new Error(hostError ? `Falha na API do Premiere: ${hostError.message}` : 'Esta ação requer o painel aberto dentro do Premiere Pro.');
  }
  async function project() {
    requireHost();
    const value = await ppro.Project.getActiveProject();
    if (!value) throw new Error('Abra um projeto no Premiere Pro.');
    return value;
  }
  async function context() {
    const p = await project(), sequence = await p.getActiveSequence();
    if (!sequence) throw new Error('Abra uma sequência no Premiere Pro.');
    return {project:p, sequence};
  }
  async function getActiveSequence() {
    const {sequence} = await context();
    return {name:sequence.name, durationSec:(await sequence.getEndTime()).seconds};
  }
  async function transaction(p, label, factory) {
    let success = false;
    await p.lockedAccess(() => { success = p.executeTransaction(compound => {
      factory().forEach(action => compound.addAction(action));
    }, label); });
    if (!success) throw new Error(`O Premiere não concluiu: ${label}.`);
  }
  async function findMedia(folder, path) {
    for (const item of await folder.getItems()) {
      let child, clip;
      try { child = ppro.FolderItem.cast(item); } catch (_) { child = null; }
      if (child) { const found = await findMedia(child, path); if (found) return found; continue; }
      try { clip = ppro.ClipProjectItem.cast(item); } catch (_) { clip = null; }
      if (clip && pathKey(await clip.getMediaFilePath()) === pathKey(path)) return item;
    }
    return null;
  }
  async function importInto(p, path) {
    if (typeof path !== 'string' || !path.trim()) throw new Error('Arquivo sem caminho válido.');
    const root = await p.getRootItem();
    let item = await findMedia(root, path);
    if (item) return item;
    if (!await p.importFiles([path], true, root, false)) throw new Error('O Premiere recusou a importação. Verifique o formato e a disponibilidade do arquivo.');
    item = await findMedia(root, path);
    if (!item) throw new Error('Arquivo importado, mas não localizado no projeto. Confira o painel Projeto antes de repetir.');
    return item;
  }
  async function importMedia(path) { return importInto(await project(), path); }
  async function insertAudio(path) {
    if (!/\.(wav|mp3|aif|aiff|m4a|aac|flac|ogg|wma)$/i.test(path)) throw new Error('A inserção direta aceita áudio. Importe vídeos pelo botão Importar.');
    const {project:p, sequence} = await context();
    const position = await sequence.getPlayerPosition();
    const item = await importInto(p, path);
    const current = await context();
    if (current.sequence.guid.toString() !== sequence.guid.toString()) throw new Error('A sequência ativa mudou. Arquivo importado; insira novamente na sequência desejada.');
    const audioTrack = await sequence.getAudioTrackCount();
    const editor = ppro.SequenceEditor.getEditor(sequence);
    await transaction(p, 'Lex Alfa: áudio em nova faixa', () => [editor.createInsertProjectItemAction(item, position, -1, audioTrack, true)]);
    return {track:audioTrack + 1, seconds:position.seconds};
  }
  async function preview(path) {
    requireHost();
    if (!await ppro.SourceMonitor.openFilePath(path)) throw new Error('Não foi possível abrir o áudio no monitor de origem.');
    if (!await ppro.SourceMonitor.play(1)) throw new Error('Áudio aberto no monitor de origem; pressione Play para ouvir.');
  }
  async function stopPreview() { if (ppro) await ppro.SourceMonitor.play(0); }
  async function chooseFile(types = ['wav','mp3','m4a','flac','aif','aiff','aac','ogg','mp4','mov','mkv']) {
    if (!fs) throw new Error('Abra o plugin no Premiere para selecionar um arquivo para processamento.');
    const entry = await fs.getFileForOpening({types});
    return entry ? {name:entry.name, path:entry.nativePath, entry} : null;
  }
  async function selectedSource() {
    const {sequence} = await context();
    const items = await (await sequence.getSelection()).getTrackItems();
    const paths = [];
    for (const item of items) {
      const clip = ppro.ClipProjectItem.cast(await item.getProjectItem());
      if (!clip || await clip.isSequence() || await clip.isOffline()) continue;
      const path = await clip.getMediaFilePath();
      if (path && !paths.some(p => pathKey(p.path) === pathKey(path))) paths.push({path, name:clip.name});
    }
    if (paths.length !== 1) throw new Error('Selecione um único arquivo de origem na timeline (áudio e vídeo vinculados podem estar juntos).');
    return paths[0];
  }
  async function bundledSfx(id) {
    if (!['clique','whoosh','pop','ding','impacto'].includes(id)) throw new Error('Efeito inválido.');
    if (!fs) return `assets/sfx/${id}.wav`;
    const data = await fs.getDataFolder();
    let folder, file;
    try { folder = await data.getEntry('sfx'); } catch (_) { folder = await data.createFolder('sfx'); }
    try { file = await folder.getEntry(`${id}.wav`); }
    catch (_) {
      const bundled = await (await fs.getPluginFolder()).getEntry(`assets/sfx/${id}.wav`);
      file = await folder.createFile(`${id}.wav`, {overwrite:false});
      await file.write(await bundled.read({format:uxp.storage.formats.binary}), {format:uxp.storage.formats.binary});
    }
    return file.nativePath;
  }
  return {isMock:!ppro, isPremiere:!!ppro, fs, context, getActiveSequence, importMedia, insertAudio, preview, stopPreview, chooseFile, selectedSource, bundledSfx};
})();
