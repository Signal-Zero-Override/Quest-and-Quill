(() => {
  'use strict';
  const cfg = window.QUEST_AND_QUILL_DATA;
  const storeKey = 'quest-quill-beta-v1';
  const active = cfg.quests.filter(q => q.active);
  const byId = id => document.getElementById(id);
  let journal;
  try { journal = JSON.parse(localStorage.getItem(storeKey)) || {}; } catch (_) { journal = {}; }
  let selected = null;
  const save = () => { try { localStorage.setItem(storeKey, JSON.stringify(journal)); } catch (_) {} };
  const completed = q => Boolean(journal[q.id] && journal[q.id].complete);
  const solved = q => Boolean(journal[q.id] && journal[q.id].solved);
  const isPuzzle = q => Boolean(q.puzzle && q.puzzle.answerHash);
  const normalizeAnswer = s => String(s||'').toLowerCase().normalize('NFKC').trim().replace(/[^a-z0-9]/g,'');
  const sha256 = async s => { const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join(''); };
  const canFinish = q => !isPuzzle(q) || solved(q);
  const makeText = (tag, text, cls) => { const el = document.createElement(tag); if(cls) el.className=cls; el.textContent=text; return el; };
  function renderBoard() {
    byId('progress').textContent = `${active.filter(completed).length} of ${active.length} completed`;
    byId('rotation-title').textContent = cfg.rotationName ? 'CURRENT ROTATION · '+cfg.rotationName : '';
    const container = byId('quest-list'); container.replaceChildren();
    if (!active.length) { container.append(makeText('p', 'New quests are being prepared. Check the physical bulletin board for updates.')); return; }
    active.forEach(q => {
      const card = makeText('article','', 'quest-card');
      card.append(makeText('div',q.category.toUpperCase(),'kicker'));
      card.append(makeText('h3',q.title));
      card.append(makeText('p',q.teaser));
      card.append(makeText('div',(q.type||'EXPLORE')+' · ABOUT '+(q.minutes||10)+' MIN','quest-meta'));
      if (completed(q)) card.append(makeText('div','✓ Completed on this device','badge'));
      const btn = makeText('button',completed(q)?'View completed quest':'Open quest','primary');
      btn.type='button'; btn.addEventListener('click',() => openQuest(q.id, true)); card.append(btn);
      container.append(card);
    });
  }
  function setQuery(id) {
    const url = new URL(window.location.href);
    if(id) url.searchParams.set('quest',id); else url.searchParams.delete('quest');
    history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  function openQuest(id, updateQuery) {
    const q = active.find(x=>x.id===id);
    if (!q) { showBoard(); return; }
    selected=q;
    if(updateQuery) setQuery(id);
    byId('detail-category').textContent=q.category.toUpperCase();
    byId('detail-title').textContent=q.title;
    byId('detail-teaser').textContent=q.teaser;
    byId('detail-mission').textContent=q.mission;
    byId('detail-alternate').textContent=q.alternate||'Explore at your own pace.';
    byId('detail-time').textContent=(q.type||'QUEST')+' · ABOUT '+(q.minutes||10)+' MIN';
    byId('puzzle-panel').hidden=!isPuzzle(q);
    byId('puzzle-answer').value='';
    byId('puzzle-result').textContent=isPuzzle(q)&&solved(q)?'Puzzle solved on this device. You may complete the quest.':'';
    byId('puzzle-hint').hidden=true;
    byId('puzzle-hint').textContent=q.puzzle?.hint||'';
    byId('check-answer').disabled=isPuzzle(q)&&solved(q);
    byId('show-hint').hidden=!isPuzzle(q)||solved(q);
    byId('reflection-label').textContent=q.reflection;
    byId('note').value=(journal[q.id]||{}).note||'';
    byId('complete').textContent=completed(q)?'Mark incomplete':(isPuzzle(q)&&!solved(q)?'Solve puzzle to complete':'Mark quest complete');
    byId('complete').disabled=!completed(q)&&!canFinish(q);
    byId('detail-status').textContent=completed(q)?'This quest is marked complete in your journal.':'';
    byId('quest-list').hidden=true;
    byId('detail').hidden=false;
    byId('detail').scrollIntoView({behavior:'smooth',block:'start'});
    byId('detail-title').setAttribute('tabindex','-1'); byId('detail-title').focus({preventScroll:true});
  }
  function showBoard() {
    selected=null;
    setQuery(null);
    byId('detail').hidden=true;
    byId('quest-list').hidden=false;
    renderBoard();
    byId('main').scrollIntoView({behavior:'smooth'});
  }
  byId('back').addEventListener('click',showBoard);
  byId('save-note').addEventListener('click',() => {
    if(!selected)return;
    journal[selected.id]={...(journal[selected.id]||{}),note:byId('note').value};save();
    byId('detail-status').textContent='Note saved on this device.';
  });
  byId('complete').addEventListener('click',() => {
    if(!selected || (!completed(selected) && !canFinish(selected)))return;
    journal[selected.id]={...(journal[selected.id]||{}),note:byId('note').value,complete:!completed(selected)};
    save();
    byId('complete').textContent=completed(selected)?'Mark incomplete':'Mark quest complete';
    byId('detail-status').textContent=completed(selected)?'Quest completed. Your discovery is saved on this device.':'Quest changed to incomplete.';
    renderBoard();
  });
  byId('check-answer').addEventListener('click',async () => {
    if(!selected || !isPuzzle(selected) || solved(selected)) return;
    const guess=normalizeAnswer(byId('puzzle-answer').value);
    if(!guess){byId('puzzle-result').textContent='Enter a word first.';return;}
    byId('check-answer').disabled=true;
    try {
      const digest=await sha256('qqbeta|'+selected.id+'|'+guess);
      if(digest===selected.puzzle.answerHash){
        journal[selected.id]={...(journal[selected.id]||{}),solved:true};save();
        byId('puzzle-result').textContent='Correct! You unlocked completion.';
        byId('complete').disabled=false;byId('complete').textContent='Mark quest complete';
        byId('show-hint').hidden=true;
      } else {
        journal[selected.id]={...(journal[selected.id]||{}),attempts:((journal[selected.id]||{}).attempts||0)+1};save();
        byId('puzzle-result').textContent='Not yet. Re-read the clues; the answer is not revealed by trying wrong options.';
        byId('check-answer').disabled=false;
      }
    }catch(_){byId('puzzle-result').textContent='Answer checking requires a secure HTTPS page. Try the deployed quest website.';byId('check-answer').disabled=false;}
  });
  byId('puzzle-answer').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();byId('check-answer').click();}});
  byId('show-hint').addEventListener('click',()=>{byId('puzzle-hint').hidden=false;});
  byId('reset').addEventListener('click',() => {
    if(!window.confirm('Clear your saved Quest & Quill notes and completion marks on this device?'))return;
    journal={};save();showBoard();
  });
  if(cfg.feedbackUrl && /^https:\/\//i.test(cfg.feedbackUrl)) {
    const place=byId('feedback-action');place.replaceChildren();
    const a=makeText('a','Share your beta feedback ↗');a.href=cfg.feedbackUrl;a.target='_blank';a.rel='noopener noreferrer';place.append(a);
    place.append(makeText('p','The feedback form opens separately. You do not need to submit your private quest notes.'));
  }
  renderBoard();
  const direct = new URL(window.location.href).searchParams.get('quest');
  if (direct) {
    if (active.some(q=>q.id===direct)) openQuest(direct,false);
    else { byId('quest-list').prepend(makeText('p','That quest is not currently displayed. Choose another available quest.')); setQuery(null); }
  }
})();
