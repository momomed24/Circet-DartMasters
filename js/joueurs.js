
(function(){
  function populate(){
    const sel = document.getElementById('joueur-select'); if(!sel) return;
    sel.innerHTML = ''; APP.JOUEURS.forEach(j=>{ const o=document.createElement('option'); o.value=j; o.textContent=j; sel.appendChild(o); });
    sel.addEventListener('change', e=>{
      const nom = e.target.value; const box = document.getElementById('joueur-stats'); if(!nom){ box.classList.add('hidden'); return; }
      const classement = calculerClassement(window.matchs || []); const j = classement.find(x=>x.nom===nom); if(!j){ box.classList.add('hidden'); return; }
      document.getElementById('joueur-nom').textContent = j.nom;
      document.getElementById('stat-matchs').textContent = j.matchs;
      document.getElementById('stat-victoires').textContent = j.victoires;
      document.getElementById('stat-defaites').textContent = j.defaites;
      document.getElementById('stat-ratio').textContent = j.matchs ? ((j.victoires/j.matchs)*100).toFixed(2) + '%' : '0.00%';
      document.getElementById('stat-elo').textContent = j.elo.toFixed(2);
      box.classList.remove('hidden');
    });
  }
  window.initPlayersModule = populate;
})();
