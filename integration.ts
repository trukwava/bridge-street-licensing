import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
const base='http://127.0.0.1:4173/api';
let cookie='',csrf='';
const read=()=>fetch(base,{headers:{Cookie:cookie}}).then(r=>r.json());
async function write(p:string,b:any,code=200){
 const r=await fetch(base+'/'+p,{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookie,'X-CSRF-Token':csrf},body:JSON.stringify(b)});
 assert.equal(r.status,code,p+' expected '+code+' got '+r.status+' '+await r.clone().text());
 return r.json();
}
const locked=await fetch(base);assert.equal(locked.status,401,'Cases must be private until sign-in');
const refusedWrite=await fetch(base+'/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
assert.equal(refusedWrite.status,401);
const loginResponse=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Taylor',password:process.env.BSL_TEST_PASSWORD})});
assert.equal(loginResponse.status,200,'Provisioned supervisor can log in');
cookie=loginResponse.headers.get('set-cookie')!.split(';')[0];
const loginResult=await loginResponse.json();csrf=loginResult.csrfToken;
assert.equal(loginResult.user.role,'supervisor');
assert.match(loginResponse.headers.get('set-cookie')||'',/HttpOnly; SameSite=Strict/);
await write('reset',{});let d=await read();

const normalHeaders=await fetch(base,{headers:{Cookie:cookie}});
assert.match(normalHeaders.headers.get('content-security-policy')||'',/default-src 'self'/);
assert.equal(normalHeaders.headers.get('x-frame-options'),'DENY');
assert.equal(normalHeaders.headers.get('cache-control'),'no-store');
const foreignHostStatus=await new Promise<number>((resolve,reject)=>{
 const req=httpRequest(base,{headers:{Host:'external.invalid'}},res=>{
  res.resume();res.on('end',()=>resolve(res.statusCode||0));
 });
 req.on('error',reject);req.end();
});
assert.equal(foreignHostStatus,403,'Only loopback Host headers are allowed');

assert.equal(d.portfolio.reduce((n:any,g:any)=>n+g.count,0),14,'Live portfolio excludes withdrawn records');
assert.equal(d.deficiencyInbox.length,10,'Seeded unresolved deficiencies are present');

assert.equal(d.observatory.counts.activeCases,14,'Observatory excludes withdrawn case from live census');
assert.equal(d.observatory.counts.overdueTasks,3);
assert.equal(d.observatory.counts.unassignedTasks,2);
assert.equal(d.observatory.counts.unresolvedEvidence,10);
assert.equal(d.observatory.counts.recordedHandoffs,0);
assert.equal(d.observatory.priorityItems.every((item:any)=>item.appId!=='BS-015'&&item.sourceId),true);
assert.equal(d.observatory.priorityItems.some((item:any)=>item.appId==='BS-002'&&item.kind==='task'),true);

assert.equal(d.nextActions['BS-001'].kind,'deficiency');
assert.equal(d.nextActions['BS-001'].sourceId,'BS-001-D1');
assert.match(d.nextActions['BS-001'].title,/Proof of business address/);
assert.equal(d.nextActions['BS-015'].kind,'inactive');

assert.equal(d.deficiencyInbox.every((x:any)=>x.reference&&x.appId&&x.verification!=='verified'),true,'Every inbox row has stable application identity');
assert.equal(d.portfolio.some((g:any)=>g.stage==='Intake'),true);
const css=await fetch('http://127.0.0.1:4173/atelier.css');assert.equal(css.status,200,'Atelier CSS must be served');
assert.match(await css.text(),/ATELIER/);
const html=await fetch('http://127.0.0.1:4173/');assert.equal(html.status,200);
const markup=await html.text();assert.match(markup,/data-view="portfolio"/);assert.match(markup,/data-view="deficiencies"/);assert.match(markup,/id="caseFinder"/);assert.match(markup,/id="quickFind"/);
const appJS=await fetch('http://127.0.0.1:4173/app.js');assert.equal(appJS.status,200);
const appSource=await appJS.text();assert.match(appSource,/function deficienciesScreen/);assert.match(appSource,/function showFinder/);assert.equal(d.apps.length,15);assert.equal(d.apps.flatMap((a:any)=>a.tasks).length,40);assert.equal(d.apps.flatMap((a:any)=>a.deficiencies).length,10);assert.equal(d.today.filter((t:any)=>t.flags.includes('Overdue')).length,3);assert.equal(d.today.filter((t:any)=>t.flags.includes('Unassigned')).length,2);
const invalidToday=await fetch(base+'?today=2026-02-30',{headers:{Cookie:cookie}});assert.equal(invalidToday.status,400);
let dueCase=d.apps.find((a:any)=>a.id==='BS-002'),dueTask=dueCase.tasks[0];
const originalProvenance=dueTask.provenance;
let updatedDue=await write('task',{id:dueCase.id,revision:dueCase.revision,taskId:dueTask.id,state:dueTask.state,owner:dueTask.owner,due:dueTask.due});
assert.equal(updatedDue.tasks[0].provenance,originalProvenance,'Owner/state-only edits must not invent deadline provenance');
await write('task',{id:updatedDue.id,revision:updatedDue.revision,taskId:dueTask.id,state:dueTask.state,owner:dueTask.owner,due:'2026-02-30'},400);

const bounds=d.apps.find((item:any)=>item.id==='BS-001');
await write('handoff',{id:bounds.id,revision:bounds.revision,owner:'Morgan',note:'x'.repeat(2001)},400);
await write('deficiency',{id:bounds.id,revision:bounds.revision,description:'Bounded test',evidence:'x'.repeat(1001)},400);
await write('reference',{id:bounds.id,revision:bounds.revision,kind:'documents',label:'Bounded test',reference:'x'.repeat(1001)},400);
const cancelCase=(await read()).apps.find((item:any)=>item.id==='BS-002');
const cancelTask=cancelCase.tasks[0];
await write('task',{id:cancelCase.id,revision:cancelCase.revision,taskId:cancelTask.id,state:'cancelled',owner:cancelTask.owner,due:cancelTask.due},400);
const cancelled=await write('task',{id:cancelCase.id,revision:cancelCase.revision,taskId:cancelTask.id,state:'cancelled',owner:cancelTask.owner,due:cancelTask.due,note:'Demo supervisor: this checklist task is no longer required'});
assert.equal(cancelled.tasks[0].state,'cancelled');
assert.match(cancelled.activity[0].action,/no longer required/);
let a=d.apps.find((a:any)=>a.id==='BS-001');await write('stage',{id:a.id,revision:a.revision},400);a=await write('draft',{id:a.id,revision:a.revision});assert.match(a.drafts[0].body,/Proof of business address/);assert.doesNotMatch(a.drafts[0].body,/Signed applicant declaration/);
assert.match(a.drafts[0].body,/internal intake checklist/i);
const draftId=a.drafts[0].id;
await write('save-draft',{id:a.id,revision:a.revision,draftId,body:'Ready for review',state:'accepted',recipient:''},400);
a=await write('save-draft',{id:a.id,revision:a.revision,draftId,body:'Needs another review',state:'rejected',recipient:''});
assert.equal(a.drafts[0].state,'rejected');
a=await write('save-draft',{id:a.id,revision:a.revision,draftId,body:'Approved internal follow-up',state:'accepted',recipient:'synthetic@example.test'});
assert.equal(a.drafts[0].state,'accepted');assert.equal(a.drafts[0].recipient,'synthetic@example.test');
a=await write('stage',{id:a.id,revision:a.revision,reason:'Demo supervisor: continue preparation while address is collected'});assert.equal(a.stage,'Preparation');assert.equal(a.deficiencies[0].verification,'unverified');assert.match(a.activity[0].action,/override/);
a=(await read()).apps.find((a:any)=>a.id==='BS-005');const t=a.tasks.find((t:any)=>t.owner==='Alex');const old=a.revision;a=await write('task',{id:a.id,revision:old,taskId:t.id,state:t.state,owner:'Morgan',due:'2026-10-20',note:'Morgan will review the supporting file'});await write('task',{id:a.id,revision:old,taskId:t.id,state:'completed',owner:'Morgan'},409);d=await read();assert.equal(d.today.find((x:any)=>x.id===t.id).owner,'Morgan');assert.match(a.activity[0].action,/Alex → Morgan/);
const snapshot=JSON.stringify(a.templateSnapshot);await write('template',{tasks:'New intake task\nReview revised documents',followupIntros:{Intake:'Custom approved intake wording for the synthetic demo:'}});a=(await read()).apps.find((x:any)=>x.id===a.id);assert.equal(JSON.stringify(a.templateSnapshot),snapshot);
const created=await write('create',{client:'New client',business:'New case after versioning',reference:'NEW-2026-A',jurisdiction:'Fictional',owner:'Alex',priority:'Normal'});
assert.equal(created.templateVersion,2);
assert.equal(created.templateSnapshot.followupIntros.Intake,'Custom approved intake wording for the synthetic demo:');
const newDraft=await write('draft',{id:created.id,revision:created.revision});
assert.match(newDraft.drafts[0].body,/Custom approved intake wording/);
assert.equal(a.templateVersion,1);

const templateVersions=(await read()).templates.map((t:any)=>t.version);
assert.ok(templateVersions.length>1,'Versioning must create a second version');

await write('reference',{id:'foreign',revision:1,kind:'documents',label:'test',reference:'x'},400);
await write('create',{client:'Test',business:'Test shop',reference:'TEST-001',jurisdiction:'Fictional',owner:'Alex',priority:'Normal'});await write('create',{client:'Test',business:'Duplicate',reference:'TEST-001',jurisdiction:'Fictional',owner:'Alex',priority:'Normal'},400);
const withdrawn=(await read()).apps.find((x:any)=>x.id==='BS-015');
await write('draft',{id:withdrawn.id,revision:withdrawn.revision},400);
await write('task',{id:withdrawn.id,revision:withdrawn.revision,taskId:withdrawn.tasks[0].id,state:'completed',owner:withdrawn.tasks[0].owner},400);
await write('stage',{id:withdrawn.id,revision:withdrawn.revision,reason:'Not authorized when withdrawn'},400);
const coordLogin=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Morgan',password:process.env.BSL_TEST_COORD_PASSWORD})});
assert.equal(coordLogin.status,200);
const coordinatorCookie=coordLogin.headers.get('set-cookie')!.split(';')[0];
const coordinatorCsrf=(await coordLogin.json()).csrfToken;
const coordinatorPost=async(p:string,payload:any)=>{
 const response=await fetch(base+'/'+p,{method:'POST',headers:{'Content-Type':'application/json','Cookie':coordinatorCookie,'X-CSRF-Token':coordinatorCsrf},body:JSON.stringify(payload)});
 return response.status;
};
assert.equal(await coordinatorPost('reset',{}),403,'Coordinator cannot wipe demo');
assert.equal(await coordinatorPost('template',{tasks:'Unauthorized'}),403);
const identityCase=(await read()).apps.find((record:any)=>record.id==='BS-001');
assert.equal(await coordinatorPost('status',{id:identityCase.id,revision:identityCase.revision,status:'withdrawn'}),403);
assert.equal(await coordinatorPost('stage',{id:identityCase.id,revision:identityCase.revision,reason:'Unauthorized override'}),403);
const csrfRejected=await fetch(base+'/reset',{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookie,'X-CSRF-Token':'not-a-valid-token'},body:'{}'});
assert.equal(csrfRejected.status,403);
const noCsrf=await fetch(base+'/reset',{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookie},body:'{}'});
assert.equal(noCsrf.status,403);
const me=await fetch(base+'/auth/me',{headers:{Cookie:cookie}});
assert.equal((await me.json()).user.username,'Taylor');
await write('reset',{});
d=await read();
assert.deepEqual(d.templates.map((t:any)=>t.version),[1],'Reset must restore template library to version 1');
assert.equal(d.apps.length,15);
const ended=await fetch(base+'/auth/logout',{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookie,'X-CSRF-Token':csrf},body:'{}'});
assert.equal(ended.status,200);
assert.equal((await fetch(base,{headers:{Cookie:cookie}})).status,401,'Logout must revoke session');
console.log('PASS: authentication, CSRF, supervisor/coordinator authorization, seed counts, draft identity, stage blocker/override, persisted handoff, stale-edit conflict, immutable template, record scope, create validation. Atelier assets and portfolio/deficiency models verified. Demo restored.');
