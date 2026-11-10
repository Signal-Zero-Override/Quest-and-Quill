(() => {
  'use strict';
  let accessKey='';
  let data=null;
  const $=id=>document.getElementById(id);
  const form=$('staff-login');
  const loginStatus=$('staff-login-status');
  const allEvents=type=>(data?.activity||[]).filter(x=>x.event_type===type).reduce((n,x)=>n+Number(x.total||0),0);
  const cell=(tag,value)=>{
    const el=document.createElement(tag);
    el.textContent=String(value);
    return el;
  };
  const shortQuest=id=>String(id||'').replace(/^qq[0-9]{2}-/,'').split('-').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ');
  const safeCSV=value=>{
    let s=String(value==null?'':value);
    // Protect spreadsheet users against formula execution from submitted text.
    if(/^[\s]*[=+\-@\t\r]/u.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  };
  async function load() {
    const response=await fetch('/api/staff-report',{
      headers:{'Authorization':'Bearer '+accessKey,'Accept':'application/json'},
      credentials:'omit',
      cache:'no-store'
    });
    let body;
    try {body=await response.json();}catch(_){body={};}
    if(!response.ok) throw new Error(body.error||'Unable to load staff report.');
    data=body;
    render();
  }
  function render() {
    if(!data)return;
    $('updated').textContent='Report generated '+new Date(data.generated_at).toLocaleString();
    $('total-feedback').textContent=Number(data.summary?.responses||0).toLocaleString();
    $('avg-rating').textContent=data.summary?.average_rating===null?'—':(data.summary?.average_rating??'—');
    $('quest-opens').textContent=allEvents('quest_open').toLocaleString();
    $('quest-completions').textContent=allEvents('quest_complete').toLocaleString();
    $('puzzle-correct').textContent=allEvents('puzzle_correct').toLocaleString();
    $('hints').textContent=allEvents('hint_open').toLocaleString();
    const bars=$('rating-bars'); bars.replaceChildren();
    const total=Number(data.summary?.responses||0);
    for(const rating of [5,4,3,2]){
      const count=Number((data.ratings||[]).find(v=>Number(v.rating)===rating)?.count||0);
      const row=document.createElement('div');
      const label=cell('strong',rating+' / 5');
      const bar=document.createElement('div');bar.className='bar';
      const fill=document.createElement('span');
      fill.style.width=(total?Math.min(100,100*count/total):0)+'%';
      bar.append(fill);row.append(label,bar,cell('span',String(count)));
      bars.append(row);
    }
    const rotation=$('rotation').value;
    const rows=$('quest-rows');
    rows.replaceChildren();
    const questMap=new Map();
    for(const entry of data.activity||[]){
      if(rotation!=='all' && entry.rotation!==rotation)continue;
      const k=entry.quest_id;
      if(!questMap.has(k))questMap.set(k,{opens:0,completed:0,correct:0,hints:0});
      const q=questMap.get(k);
      const n=Number(entry.total||0);
      if(entry.event_type==='quest_open')q.opens+=n;
      if(entry.event_type==='quest_complete')q.completed+=n;
      if(entry.event_type==='puzzle_correct')q.correct+=n;
      if(entry.event_type==='hint_open')q.hints+=n;
    }
    const quests=[...questMap.entries()].sort((a,b)=>b[1].opens-a[1].opens);
    if(!quests.length){
      const row=document.createElement('tr');const td=cell('td','No quest activity recorded for this selection yet.');td.colSpan=5;row.append(td);rows.append(row);
    }
    for(const [id,q] of quests){
      const row=document.createElement('tr');
      row.append(cell('td',shortQuest(id)),cell('td',q.opens),cell('td',q.completed),cell('td',q.correct),cell('td',q.hints));
      rows.append(row);
    }
    const comments=$('feedback-entries');comments.replaceChildren();
    const records=(data.feedback||[]).filter(x=>rotation==='all'||x.rotation===rotation);
    if(!records.length){comments.append(cell('p','No feedback for this rotation yet.'));return;}
    for(const item of records){
      const article=document.createElement('article');article.className='entry';
      const meta=cell('div',String(item.rating)+' / 5 · Rotation '+(item.rotation||'—')+' · '+String(item.created_at||'')+' UTC');
      meta.className='meta';article.append(meta);
      const fields=[['Favorite part',item.liked],['Confusing',item.confusing],['Suggestions',item.improve]];
      if(!fields.some(([,v])=>v))article.append(cell('p','No written comment.'));
      for(const [label,value] of fields){
        if(!value)continue;
        const p=document.createElement('p');
        const b=cell('strong',label+': ');
        p.append(b,document.createTextNode(String(value)));
        article.append(p);
      }
      comments.append(article);
    }
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    accessKey=$('staff-key').value.trim();
    loginStatus.textContent='Loading protected report…';
    $('staff-login-btn').disabled=true;
    try {
      await load();
      $('staff-key').value='';
      $('login-panel').hidden=true;
      $('report').hidden=false;
      loginStatus.textContent='';
    }catch(err){
      accessKey='';data=null;
      loginStatus.textContent=err.message||'Unable to authenticate.';
    }finally{$('staff-login-btn').disabled=false;}
  });
  $('rotation').addEventListener('change',render);
  $('refresh').addEventListener('click',async()=>{
    $('refresh').disabled=true;
    try{await load();}catch(err){window.alert(err.message||'Unable to refresh report.');}
    finally{$('refresh').disabled=false;}
  });
  $('logout').addEventListener('click',()=>{
    accessKey='';data=null;
    $('report').hidden=true;
    $('login-panel').hidden=false;
    $('feedback-entries').replaceChildren();$('quest-rows').replaceChildren();
    loginStatus.textContent='Staff report locked.';
  });
  $('export').addEventListener('click',()=>{
    if(!data)return;
    const header=['UTC date','Rotation','Rating','Favorite part','Confusing','Suggestions'];
    const rows=[header,...(data.feedback||[]).map(x=>[x.created_at,x.rotation,x.rating,x.liked,x.confusing,x.improve])];
    const csv='\uFEFF'+rows.map(row=>row.map(safeCSV).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;
    link.download='quest-quill-feedback-latest-100.csv';link.click();
    URL.revokeObjectURL(url);
  });
})();