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
export function draft(a: any) { return `Dear ${a.contact || '[recipient name missing]'},\n\nRegarding ${a.business} (${a.reference}), currently in ${a.stage}, please provide:\n${outstanding(a).map((s:string)=>'• '+s).join('\n') || 'No outstanding items recorded. Please confirm the next action with your coordinator.'}\n\nPlease quote ${a.reference} in your response.\n\nBridge Street Licensing\nDemo preparation office`; }
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
