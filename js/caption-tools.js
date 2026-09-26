const CaptionTools = (() => {
  let suggestion = null;
  function presets() { const saved=App.load('captionPresets',[]); return Array.isArray(saved) ? saved : []; }
  function renderPresets() {
    const select=App.$('captionPresetList'); select.textContent='';
    const empty=App.element('option','Escolha um preset salvo'); empty.value=''; select.appendChild(empty);
    presets().forEach(p=>{const option=App.element('option',p.name);option.value=p.name;select.appendChild(option);});
  }
  function savePreset(style) {
    const name=App.$('captionPresetName').value.trim();
    if (!name || name.length>60) return App.message('legendasStatus','Dê um nome ao preset (até 60 caracteres).',true);
    const all=presets().filter(p=>p.name!==name); all.push({name,style});
    App.save('captionPresets',all.slice(-100)); renderPresets(); App.$('captionPresetList').value=name;
    App.message('legendasStatus',`Preset “${name}” salvo.`);
  }
  function loadPreset() {
    const chosen=presets().find(p=>p.name===App.$('captionPresetList').value);
    if (!chosen) return App.message('legendasStatus','Escolha um preset salvo.');
    LegendasTab.applyOptions(chosen.style); App.$('captionPresetName').value=chosen.name;
  }
  function updateGuide(container,preview) {
    const top=Number(App.$('captionSafeTop').value),bottom=Number(App.$('captionSafeBottom').value),side=Number(App.$('captionSafeHorizontal').value);
    const position=App.$('captionPosition').value;
    preview.style.position='absolute';preview.style.left=`${side}%`;preview.style.right=`${side}%`;
    if (position==='top') preview.style.top=`${top}%`;
    else if (position==='center') {preview.style.top='50%';preview.style.marginTop='-10px';}
    else preview.style.bottom=`${bottom}%`;
    if (App.$('showSafeZone').checked) {
      const guide=App.element('div',undefined,'safe-guide');guide.style.top=`${top}%`;guide.style.bottom=`${bottom}%`;guide.style.left=`${side}%`;guide.style.right=`${side}%`;
      guide.setAttribute('aria-hidden','true'); container.appendChild(guide);
    }
    preview.classList.add(`motion-${App.$('captionAnimation').value}`);
  }
  async function renderSrt() {
    const result=await Processor.run('renderSrt',{srt:App.$('captionSrtText').value,style:LegendasTab.options(),
      overlay:App.$('captionOverlay').checked,layout:App.$('captionLayout').value,clicks:App.$('manchSom').checked},'legendasStatus');
    await Processor.publish(result,'legendasStatus');
  }
  async function openSrt() {
    if (!PremiereBridge.fs) {App.$('browserSrt').click();return;}
    const file=await PremiereBridge.chooseFile(['srt']);
    if (file) { const text=await file.entry.read(); if(text.length>200000) throw new Error('O SRT excede 200.000 caracteres.'); App.$('captionSrtText').value=text; App.message('legendasStatus','SRT carregado. Revise o texto e aplique o estilo escolhido.'); }
  }
  function init() {
    renderPresets();
    ['captionAnimation','captionPosition','captionSafeTop','captionSafeBottom','captionSafeHorizontal','showSafeZone'].forEach(id=>App.$(id).addEventListener('change',LegendasTab.refresh));
    App.$('deleteCaptionPreset').addEventListener('click',()=>{App.save('captionPresets',presets().filter(p=>p.name!==App.$('captionPresetList').value));renderPresets();});
    App.$('openSrtEditor').addEventListener('click',()=>App.run('legendasStatus',openSrt));
    App.$('renderSrt').addEventListener('click',()=>App.run('legendasStatus',renderSrt));
    App.$('browserSrt').addEventListener('change',e=>App.run('legendasStatus',async()=>{
      const file=e.target.files[0];if(!file)return;if(file.size>800000)throw new Error('SRT muito grande.');
      const text=await file.text();if(text.length>200000)throw new Error('O SRT excede 200.000 caracteres.');App.$('captionSrtText').value=text;e.target.value='';
    }));
    App.$('suggestEdit').addEventListener('click',()=>App.run('advisorStatus',async()=>{
      suggestion=null;
      const result=await Processor.run('suggestEdit',{brief:App.$('editingBrief').value},'advisorStatus');
      suggestion={brief:App.$('editingBrief').value,values:result.suggestions};
      App.message('advisorStatus',Object.values(result.suggestions).map(s=>`${s.label} · confiança ${Math.round(s.confidence*100)}%`).join('\n'));
    }));
    App.$('applySuggestion').addEventListener('click',()=>App.run('advisorStatus',async()=>{
      if (!suggestion || suggestion.brief!==App.$('editingBrief').value)throw new Error('Solicite uma sugestão para a descrição atual.');
      LegendasTab.applyOptions({template:suggestion.values.template.value,animation:suggestion.values.animation.value});
      App.$('zoomStrength').value=suggestion.values.zoom.value;
      App.message('advisorStatus','Estilo e animação selecionados. O zoom só será gerado se você clicar em Gerar cópia com zoom.');
    }));
    App.$('renderZoom').addEventListener('click',()=>App.run('advisorStatus',async()=>{
      if(App.$('zoomStrength').value==='none')throw new Error('Selecione uma intensidade de zoom.');
      const result=await Processor.run('zoom',{path:App.getSource().path,zoom:App.$('zoomStrength').value},'advisorStatus');
      await Processor.publish(result,'advisorStatus');
    }));
    LegendasTab.refresh();
  }
  return {init,savePreset,loadPreset,updateGuide};
})();
