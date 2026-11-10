// Quest & Quill beta feedback. Stores voluntary, anonymous answers only.
const jsonHeaders = {
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer'
};
const reply = (value, status=200) => new Response(JSON.stringify(value), {status, headers:jsonHeaders});

export async function onRequestPost({request, env}) {
  const origin = new URL(request.url).origin;
  if (origin !== 'https://quest-and-quill.pages.dev' ||
      request.headers.get('Origin') !== origin ||
      !request.headers.get('Content-Type')?.startsWith('application/json')) {
    return reply({error:'Request not accepted.'},403);
  }
  if (Number(request.headers.get('Content-Length') || 0)>2700) {
    return reply({error:'Feedback is too long.'},413);
  }
  let text;
  try { text=await request.text(); if(text.length>2700) return reply({error:'Feedback is too long.'},413); }
  catch(_) { return reply({error:'Cannot read feedback.'},400); }
  let data;
  try { data=JSON.parse(text); }
  catch(_) { return reply({error:'Invalid feedback.'},400); }
  if (!data || typeof data !== 'object') return reply({error:'Invalid feedback.'},400);
  if (typeof data.website==='string' && data.website.trim()) return reply({ok:true});
  const rating=Number(data.rating);
  if (!Number.isInteger(rating) || rating<2 || rating>5) {
    return reply({error:'Choose how much you enjoyed it.'},400);
  }
  const clean = value => typeof value==='string'
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim()
    : null;
  const liked=clean(data.liked), improve=clean(data.improve), confusing=clean(data.confusing);
  const rotation=typeof data.rotation==='string' && /^(01|02|03|04)$/.test(data.rotation) ? data.rotation : '';
  if ([liked,improve,confusing].some(v=>v===null || v.length>450)) {
    return reply({error:'Please keep each answer under 450 characters.'},400);
  }
  if (!env.QUEST_STATS) return reply({error:'Feedback is temporarily unavailable.'},503);
  try {
    await env.QUEST_STATS.prepare(
      'INSERT INTO quest_feedback (rating,liked,improve,confusing,rotation) VALUES (?,?,?,?,?)'
    ).bind(rating,liked,improve,confusing,rotation).run();
    return reply({ok:true});
  } catch (_) {
    return reply({error:'Feedback is temporarily unavailable. Please try again later.'},503);
  }
}
