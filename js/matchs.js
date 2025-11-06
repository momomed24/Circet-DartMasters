
(function(){
  window.matchs = [];

  function createOption(text,value){ const o=document.createElement('option'); o.value=value; o.textContent=text; return o; }

  function initSelects(){
    const s1=document.getElementById('joueur1'), s2=document.getElementById('joueur2');
    if(!s1||!s2) return;
    [s1,s2].forEach(s=>{ s.innerHTML=''; APP.JOUEURS.forEach(j=>s.appendChild(createOption(j,j))); });
  }

  function renderMatchs(){
    const tb=document.getElementById('matchs-body');
    if(!tb) return;
    tb.innerHTML='';
    if(!matchs.length){ tb.innerHTML='<tr><td colspan="6" style="text-align:center;color:#6b7280">Aucun match</td></tr>'; return; }
    matchs.slice().reverse().forEach((m,i)=>{
      const idx=matchs.length-1-i; const win = m.score1>m.score2?m.joueur1:m.joueur2;
      const tr=document.createElement('tr');
      tr.innerHTML = `<td>${m.joueur1}</td><td>${m.score1}</td><td>${m.joueur2}</td><td>${m.score2}</td><td>${win}</td><td><button class="btn small" data-idx="${idx}">🗑️</button></td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('button[data-idx]').forEach(b=>b.addEventListener('click', e=>{
      const i=parseInt(b.getAttribute('data-idx')); if(confirm('Supprimer ce match ?')){ matchs.splice(i,1); APP.saveMatchs(matchs).then(()=>{ renderMatchs(); afficherClassement(matchs); }); }
    }));
  }

  function bindForm(){
    const form = document.getElementById('match-form');
    if(!form) return;
    form.addEventListener('submit', async e=>{
      e.preventDefault();
      const j1=document.getElementById('joueur1').value, j2=document.getElementById('joueur2').value;
      const s1=parseInt(document.getElementById('score1').value||0,10), s2=parseInt(document.getElementById('score2').value||0,10);
      if(!j1||!j2){ alert('Choisir deux joueurs'); return; }
      if(j1===j2){ alert('Les joueurs doivent être différents'); return; }
      const match = { joueur1:j1, joueur2:j2, score1:s1, score2:s2, date: new Date().toLocaleString('fr-FR') };
      matchs.push(match);
      await APP.saveMatchs(matchs);
      renderMatchs(); afficherClassement(matchs); form.reset();
    });
  }

  window.initMatchModule = function(){ initSelects(); bindForm(); renderMatchs(); };

})();
