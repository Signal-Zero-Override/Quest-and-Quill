// Protected Quest & Quill reporting API.
// Staff key lives in Cloudflare's encrypted Pages secret, never in GitHub.
const headers = {
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store, private',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer'
};
const reply = (data,status=200)=>new Response(JSON.stringify(data),{status,headers});
async function authenticated(request, expected) {
  if (!expected || typeof expected!=='string') return false;
  const auth=request.headers.get('Authorization')||'';
  if (!auth.startsWith('Bearer ') || auth.length>250) return false;
  const supplied=auth.slice(7);
  const encoder=new TextEncoder();
  const [a,b]=await Promise.all([expected,supplied].map(value=>crypto.subtle.digest('SHA-256',encoder.encode(value))));
  const x=new Uint8Array(a),y=new Uint8Array(b);
  let different=0;
  for(let i=0;i<x.length;i++) different|=x[i]^y[i];
  return different===0;
}

export async function onRequestGet({request,env}) {
  if(!env.QUEST_STATS || !env.QQ_STAFF_REPORT_KEY) {
    return reply({error:'Staff reporting has not been configured.'},503);
  }
  if(!await authenticated(request,env.QQ_STAFF_REPORT_KEY)) {
    return reply({error:'Staff access key required.'},401);
  }
  try {
    const statements=[
      env.QUEST_STATS.prepare(
        'SELECT COUNT(*) AS responses,ROUND(AVG(rating),2) AS average_rating FROM quest_feedback'
      ).first(),
      env.QUEST_STATS.prepare(
        'SELECT rating,COUNT(*) AS count FROM quest_feedback GROUP BY rating ORDER BY rating DESC'
      ).all(),
      env.QUEST_STATS.prepare(
        'SELECT id,created_at,rotation,rating,liked,improve,confusing FROM quest_feedback ORDER BY id DESC LIMIT 100'
      ).all(),
      env.QUEST_STATS.prepare(
        'SELECT rotation,quest_id,event_type,SUM(event_count) AS total FROM quest_event_totals GROUP BY rotation,quest_id,event_type ORDER BY rotation,quest_id,event_type'
      ).all(),
      env.QUEST_STATS.prepare(
        'SELECT event_date,event_type,SUM(event_count) AS total FROM quest_event_totals GROUP BY event_date,event_type ORDER BY event_date DESC,event_type LIMIT 450'
      ).all(),
      env.QUEST_STATS.prepare(
        'SELECT substr(created_at,1,10) AS event_date,COUNT(*) AS total FROM quest_feedback GROUP BY substr(created_at,1,10) ORDER BY event_date DESC LIMIT 90'
      ).all()
    ];
    const [summary,ratings,feedback,activity,daily,feedbackDaily]=await Promise.all(statements);
    return reply({
      generated_at:new Date().toISOString(),
      summary,ratings:ratings.results||[],
      feedback:feedback.results||[],
      activity:activity.results||[],
      daily:daily.results||[],
      feedback_daily:feedbackDaily.results||[],
      notes:'Events count actions, not verified unique patrons, attendance, or checkouts.'
    });
  }catch(_){
    return reply({error:'Report temporarily unavailable.'},503);
  }
}
