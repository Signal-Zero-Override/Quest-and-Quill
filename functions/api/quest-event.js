// Quest & Quill anonymized aggregate statistics.
// No user ID, IP, user-agent, cookies, or private quest journal is stored.
const validEvents = new Set(['quest_open', 'quest_complete', 'quest_uncomplete', 'puzzle_correct', 'puzzle_incorrect', 'hint_open']);
export async function onRequestPost({request, env}) {
  const noCache = { 'Cache-Control':'no-store', 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'https://quest-and-quill.pages.dev', 'Vary':'Origin' };
  const origin = request.headers.get('Origin');
  if (origin !== 'https://quest-and-quill.pages.dev') return new Response('Forbidden', { status:403, headers:noCache });
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return new Response('Invalid type', { status:415, headers:noCache });
  if (Number(request.headers.get('Content-Length') || 0) > 700) return new Response('Too large', { status:413, headers:noCache });
  let raw;
  try { raw = await request.text(); if(raw.length>700) throw Error('too long'); } catch (_) {return new Response('Invalid body',{status:400,headers:noCache});}
  let data;
  try { data=JSON.parse(raw); } catch (_) {return new Response('Bad JSON',{status:400,headers:noCache});}
  if (!data || !validEvents.has(data.event) ||
      typeof data.quest!=='string' || !/^qq[0-9]{2}-[a-z0-9-]{1,70}$/.test(data.quest) ||
      typeof data.rotation!=='string' || !/^(01|02|03|04)$/.test(data.rotation) ||
      !data.quest.startsWith('qq'+data.rotation+'-')) {
    return new Response('Invalid event',{status:400,headers:noCache});
  }
  if (!env.QUEST_STATS) return new Response('Statistics unavailable',{status:503,headers:noCache});
  const day=new Date().toISOString().slice(0,10);
  try {
    await env.QUEST_STATS.prepare(
      'INSERT INTO quest_event_totals (event_date,rotation,quest_id,event_type,event_count) VALUES (?,?,?,?,1) ON CONFLICT(event_date,rotation,quest_id,event_type) DO UPDATE SET event_count=event_count+1'
    ).bind(day,data.rotation,data.quest,data.event).run();
    return new Response(JSON.stringify({ok:true}),{status:200,headers:noCache});
  } catch (_) {
    return new Response('Statistics unavailable',{status:503,headers:noCache});
  }
}
