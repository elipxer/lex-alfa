const App = (() => {
  const $ = id => document.getElementById(id);
  const listeners = [];
  let busy = false, source = null;
  function load(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(`lexalfa.${key}`)); return value === null ? fallback : value; }
    catch (_) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(`lexalfa.${key}`, JSON.stringify(value)); return true; }
    catch (_) { message('appStatus', 'Não foi possível salvar preferências. Verifique o armazenamento do painel.', true); return false; }
  }
  function message(id, text, error = false) {
    const el = $(id); if (!el) return;
    el.textContent = text; el.classList.toggle('error', error);
  }
  async function run(statusId, task) {
    if (busy) { message(statusId, 'Aguarde a operação em andamento.'); return; }
    busy = true;
    const controls = Array.from(document.querySelectorAll('[data-operation]'));
    const previous = controls.map(el => el.disabled);
    controls.forEach(el => { el.disabled = true; });
    try { return await task(); }
    catch (error) { message(statusId, error.message || String(error), true); }
    finally { controls.forEach((el, i) => { el.disabled = previous[i]; }); busy = false; }
  }
  function number(id, min, max) {
    const raw = $(id).value, value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value) || value < min || value > max) throw new Error(`Informe um valor entre ${min} e ${max}.`);
    return value;
  }
  function setSource(value) {
    source = value;
    $('sourceName').textContent = value ? `${value.name} — arquivo completo` : 'Nenhum arquivo selecionado';
    listeners.forEach(fn => fn(value));
  }
  function getSource() {
    if (!source || !source.path) throw new Error('Escolha um arquivo de áudio/vídeo no Premiere ou use “Processar” na biblioteca.');
    return source;
  }
  function bindPreferences() {
    const values = load('controls', {});
    document.querySelectorAll('[data-persist]').forEach(el => {
      if (Object.prototype.hasOwnProperty.call(values, el.id)) {
        if (el.type === 'checkbox') el.checked = values[el.id] === true;
        else if (typeof values[el.id] === 'string') el.value = values[el.id];
      }
      el.addEventListener('change', () => {
        values[el.id] = el.type === 'checkbox' ? el.checked : el.value;
        save('controls', values);
      });
    });
  }
  function element(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }
  function button(text, action) {
    const el = element('button', text); el.type = 'button'; el.addEventListener('click', action); return el;
  }
  return { $, load, save, run, message, number, setSource, getSource, bindPreferences, element, button,
    onSourceChange: fn => listeners.push(fn), get busy() { return busy; } };
})();
