export const stages = ['Intake','Preparation','Review','Submitted','Complete'];
export const users = ['Alex','Morgan','Jamie','Taylor'];
export const states = ['open','in progress','blocked','awaiting response','completed','cancelled'];
export function validateTask(t: any) {
 if (!states.includes(t.state)) throw Error('Unknown task state');
 if (t.owner !== null && !users.includes(t.owner)) throw Error('Choose one accountable owner or Unassigned');
 if (!String(t.title || '').trim()) throw Error('Task title required');
}
export function transition(old: string, next: string) {
 const allowed: any = {'open':['in progress','blocked','awaiting response','completed','cancelled'],'in progress':['open','blocked','awaiting response','completed','cancelled'],'blocked':['open','in progress','awaiting response','cancelled'],'awaiting response':['open','in progress','blocked','completed','cancelled'],'completed':['open'],'cancelled':['open']};
 if(old !== next && !allowed[old]?.includes(next)) throw Error(`Cannot move ${old} to ${next}. Reopen blocked work before completing it.`);
}
export function outstanding(a: any) { return [...a.tasks.filter((t:any)=>!['completed','cancelled'].includes(t.state)).map((t:any)=>t.title), ...a.deficiencies.filter((d:any)=>d.verification !== 'verified').map((d:any)=>d.description)]; }
export const sampleFollowupIntros: Record<string,string> = {
 Intake:'To finish our internal intake checklist, please review the following unresolved requirements:',
 Preparation:'While preparing the sample application packet, we still need the following items:',
 Review:'Our internal documentation review identified these items requiring attention:',
 Submitted:'Our internal submitted-stage tracker still lists the following items. This demo does not transmit official applications:',
 Complete:'For our internal closing checklist, these items remain unresolved:'
};
export function draft(a: any) {
 const items=outstanding(a);
 const intro=a.templateSnapshot?.followupIntros?.[a.stage] || sampleFollowupIntros[a.stage] || sampleFollowupIntros.Intake;
 return `Dear ${a.contact || '[recipient name missing]'},\n\nRegarding ${a.business} (${a.reference}) — ${a.stage} — ${intro}\n${items.length ? items.map((s:string)=>'• '+s).join('\n') : 'No unresolved items are recorded. Please confirm the next step with your coordinator.'}\n\nPlease quote ${a.reference} in your response. This is a staff-edited preparation draft, not correspondence from an authority.\n\nBridge Street Licensing\nDemo preparation office`;
}
export function buckets(apps:any[], today:string) {
 const soon = new Date(today+'T12:00:00Z'); soon.setUTCDate(soon.getUTCDate()+7);
 return apps.filter(a=>a.status==='active').flatMap(a=>a.tasks.filter((t:any)=>!['completed','cancelled'].includes(t.state)).map((t:any)=>({...t,appId:a.id,business:a.business,reference:a.reference,flags:[...(t.due && t.due<today?['Overdue']:[]),...(t.due && t.due>=today && t.due<=soon.toISOString().slice(0,10)?['Due soon']:[]),...(!t.owner?['Unassigned']:[]),...(t.state==='blocked'?['Blocked']:[]),...(t.state==='awaiting response'?['Awaiting client']:[])]}))).filter(t=>t.flags.length);
}

/** Deterministic read model: only unresolved deficiencies from active case files. */
export function deficiencyInbox(apps: any[], today: string) {
 return apps.filter(a => a.status === 'active').flatMap(a =>
  (a.deficiencies || []).filter((d: any) => d.verification !== 'verified').map((d: any) => ({
   id: d.id, appId: a.id, business: a.business, reference: a.reference,
   owner: a.owner, description: d.description, verification: d.verification,
   evidence: d.evidence || '', response: d.response || '',
   requested: d.requested || null, due: d.due || null,
   overdue: Boolean(d.due && d.due < today),
   nextAction: d.verification === 'received' ? 'Review and verify response' : 'Request or obtain evidence'
  }))
 ).sort((a, b) =>
  Number(b.overdue) - Number(a.overdue) ||
  (a.due || '9999-12-31').localeCompare(b.due || '9999-12-31') ||
  a.reference.localeCompare(b.reference) || String(a.id).localeCompare(String(b.id))
 );
}

/** Portfolio census excludes withdrawn and completed records from the live stage journey. */
export function portfolio(apps: any[]) {
 const active = apps.filter(a => a.status === 'active');
 return stages.map(stage => {
  const cases = active.filter(a => a.stage === stage);
  return {
   stage, count: cases.length,
   openTasks: cases.reduce((n, a) => n + (a.tasks || []).filter((t: any) => !['completed','cancelled'].includes(t.state)).length, 0),
   openDeficiencies: cases.reduce((n, a) => n + (a.deficiencies || []).filter((d: any) => d.verification !== 'verified').length, 0),
   caseIds: cases.map(a => a.id)
  };
 });
}


/**
 * Exactly one recommended next action per case. Read-only advisory, never approval.
 * Response verification takes precedence; then overdue evidence and work blockers.
 * Date-only deadlines remain source dates and are not inferred from legislation.
 */
export function caseNextAction(a: any, today: string) {
 if (a.status !== 'active') return {kind:'inactive',sourceId:null,title:'No active action',owner:null,due:null,
  explanation:'This application is not active. Review its recorded status before making changes.'};
 const defs=(a.deficiencies || []).filter((d:any)=>d.verification!=='verified');
 const tasks=(a.tasks || []).filter((t:any)=>!['completed','cancelled'].includes(t.state));
 const received=defs.find((d:any)=>d.verification==='received');
 const overdueEvidence=defs.filter((d:any)=>d.due && d.due<today).sort((x:any,y:any)=>x.due.localeCompare(y.due))[0];
 const blockedTask=tasks.find((t:any)=>t.state==='blocked');
 const unassignedTask=tasks.find((t:any)=>!t.owner);
 const overdueTask=tasks.filter((t:any)=>t.due&&t.due<today).sort((x:any,y:any)=>x.due.localeCompare(y.due))[0];
 const evidence=received||overdueEvidence||(tasks.length?null:defs[0])||defs[0];
 if(received) return {kind:'deficiency',sourceId:received.id,title:'Verify response: '+received.description,
  owner:a.owner||null,due:received.due||null,explanation:'A client response was recorded but the evidence is not verified.'};
 if(overdueEvidence) return {kind:'deficiency',sourceId:overdueEvidence.id,title:'Request overdue evidence: '+overdueEvidence.description,
  owner:a.owner||null,due:overdueEvidence.due,explanation:'User-entered due date has passed; no evidence verification recorded.'};
 if(blockedTask) return {kind:'task',sourceId:blockedTask.id,title:'Unblock task: '+blockedTask.title,
  owner:blockedTask.owner||null,due:blockedTask.due||null,explanation:'Blocked work must be reopened before it can be completed.'};
 if(unassignedTask) return {kind:'task',sourceId:unassignedTask.id,title:'Assign task: '+unassignedTask.title,
  owner:null,due:unassignedTask.due||null,explanation:'No accountable task owner has been assigned.'};
 if(overdueTask) return {kind:'task',sourceId:overdueTask.id,title:'Follow up on task: '+overdueTask.title,
  owner:overdueTask.owner||null,due:overdueTask.due,explanation:'The user-entered deadline has passed and the task remains open.'};
 if(evidence) return {kind:'deficiency',sourceId:evidence.id,title:'Collect evidence: '+evidence.description,
  owner:a.owner||null,due:evidence.due||null,explanation:'The deficiency remains unresolved; verify evidence before marking it complete.'};
 if(tasks.length){
  const first=[...tasks].sort((x:any,y:any)=>(x.due||'9999-12-31').localeCompare(y.due||'9999-12-31'))[0];
  return {kind:'task',sourceId:first.id,title:'Progress task: '+first.title,owner:first.owner||null,
   due:first.due||null,explanation:'An open task remains in the application checklist.'};
 }
 return {kind:'review',sourceId:null,title:'Ready for coordinator review',owner:a.owner||null,due:null,
  explanation:'No outstanding task or unverified deficiency is recorded. Stage advancement still requires staff review.'};
}


/** True only for a real YYYY-MM-DD calendar date; does not convert dates to instants. */
export function isDateOnly(value: unknown): boolean {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const [y,m,d]=value.split('-').map(Number);
 if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1) return false;
 const candidate=new Date(Date.UTC(y,m-1,d));
 return candidate.getUTCFullYear()===y && candidate.getUTCMonth()===m-1 && candidate.getUTCDate()===d;
}
