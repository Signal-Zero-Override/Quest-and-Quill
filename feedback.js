(() => {
  'use strict';
  const form=document.getElementById('feedback-form');
  if(!form) return;
  const status=document.getElementById('feedback-status');
  const submit=document.getElementById('feedback-submit');
  const stampKey='qq-feedback-last-submit-v1';
  const DAY=24*60*60*1000;
  function lastSent() {
    try { return Number(localStorage.getItem(stampKey))||0; } catch(_) { return 0; }
  }
  function lockIfRecent() {
    if(Date.now()-lastSent()<DAY) {
      submit.disabled=true;
      status.textContent='Thank you! Feedback was sent from this device recently. You can send another response tomorrow.';
      return true;
    }
    return false;
  }
  lockIfRecent();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if(lockIfRecent()) return;
    const rating=form.querySelector('input[name="rating"]:checked');
    if(!rating) { status.textContent='Please choose a rating first.'; return; }
    const payload={
      rating:Number(rating.value),
      liked:form.elements.namedItem('liked').value,
      improve:form.elements.namedItem('improve').value,
      confusing:form.elements.namedItem('confusing').value,
      website:form.elements.namedItem('website').value
    };
    submit.disabled=true;
    status.textContent='Sending your feedback…';
    try {
      const resp=await fetch('/api/feedback',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'omit',
        body:JSON.stringify(payload)
      });
      let data={};
      try {data=await resp.json();}catch(_){}
      if(!resp.ok || !data.ok) throw new Error(data.error || 'Unable to save feedback.');
      try {localStorage.setItem(stampKey,String(Date.now()));}catch(_){}
      form.reset();
      status.textContent='Thank you, adventurer! Your anonymous feedback has been received.';
      submit.textContent='Feedback received ✓';
    }catch(err) {
      status.textContent=(err && err.message?err.message:'Unable to send feedback.')+' You can use a paper feedback slip instead.';
      submit.disabled=false;
    }
  });
})();