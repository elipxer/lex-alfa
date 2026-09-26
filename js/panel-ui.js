const PanelUI = (() => {
  function init() {
    document.querySelectorAll('button').forEach(button=>{
      button.setAttribute('uxp-variant',button.classList.contains('btn-primary')?'cta':'action');
      if(button.classList.contains('text-button') || button.classList.contains('tab-btn') || button.classList.contains('disclosure'))button.setAttribute('uxp-quiet','true');
    });
    document.querySelectorAll('[data-disclosure]').forEach(button=>{
      const region=App.$(button.getAttribute('aria-controls'));
      button.addEventListener('click',()=>{
        const open=button.getAttribute('aria-expanded')!=='true';
        button.setAttribute('aria-expanded',String(open));region.hidden=!open;
      });
    });
    LocalEngine.observe(({phase,message})=>{
      const ready=phase==='ready',connecting=phase==='connecting';
      const status=App.$('engineLabel');status.textContent=ready?'Conectado':connecting?'Conectando…':phase==='preview'?'Prévia':'Desconectado';
      App.$('engineIndicator').setAttribute('data-state',phase);
      App.$('engineSetup').hidden=ready;
      App.$('engineMessage').textContent=message;
      App.$('activateEngine').textContent=connecting?'Preparando…':phase==='error'?'Tentar novamente':'Ativar Lex Alfa';
      App.$('activateEngine').disabled=connecting || phase==='preview';
      App.$('checkProcessor').disabled=connecting || phase==='preview';
      App.$('processorStatus').textContent=message;
    });
    App.$('activateEngine').addEventListener('click',()=>App.run('processorStatus',async()=>{
      await LocalEngine.connect(true);App.save('autoConnect',App.$('autoConnect').checked);
    }));
    App.$('autoConnect').checked=App.load('autoConnect',true);
    App.$('autoConnect').addEventListener('change',()=>App.save('autoConnect',App.$('autoConnect').checked));
    App.$('openOutputs').addEventListener('click',()=>App.run('appStatus',LocalEngine.openOutputs));
    App.onSourceChange(value=>{
      App.$('sourceCard').classList.toggle('has-source',!!value);
      App.$('sourceHint').textContent=value?'O processamento usa o arquivo completo. Seus originais são preservados.':'Escolha um arquivo ou use o clipe selecionado na timeline.';
    });
    const tabs=Array.from(document.querySelectorAll('.tab-btn'));
    tabs.forEach((button,index)=>button.addEventListener('keydown',event=>{
      let next;
      if(event.key==='ArrowRight' || event.key==='ArrowDown')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft' || event.key==='ArrowUp')next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;
      if(event.key==='End')next=tabs.length-1;
      if(next!==undefined){event.preventDefault();tabs[next].focus();tabs[next].click();}
    }));
    LocalEngine.init();
  }
  return {init};
})();
