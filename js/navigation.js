
(function(){
  function bind(){
    document.querySelectorAll('.nav-link').forEach(l=>l.addEventListener('click', e=>{
      e.preventDefault(); const page = e.target.dataset.page;
      document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));
      e.target.classList.add('active');
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
      const target = document.getElementById('page-' + page);
      if(target) target.classList.add('active');
      if(page==='classement') afficherClassement(window.matchs || []);
      if(page==='matchs') initMatchModule();
      if(page==='joueurs') initPlayersModule();
    }));
  }
  window.initNav = bind;
})();
