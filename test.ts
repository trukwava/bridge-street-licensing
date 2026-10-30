import {test} from 'node:test';import assert from 'node:assert/strict';import {draft,buckets,transition,validateTask,deficiencyInbox,portfolio} from './domain.ts';
test('blocked is not complete; reopen first',()=>{assert.throws(()=>transition('blocked','completed'));transition('blocked','in progress');transition('in progress','completed')});
test('exactly one known owner or explicit unassigned',()=>{validateTask({title:'A',state:'open',owner:null});assert.throws(()=>validateTask({title:'A',state:'open',owner:['Alex','Morgan']}))});
test('draft uses only source application unresolved items',()=>{const s=draft({business:'Harbor',reference:'A1',stage:'Intake',contact:'Reed',tasks:[{title:'Intake',state:'completed'}],deficiencies:[{description:'Proof of address',verification:'unverified'}]});assert.match(s,/Proof of address/);assert.doesNotMatch(s,/declaration/)});
test('withdrawn tasks suppressed and date-only due buckets are exact',()=>{const apps=[{id:'1',status:'active',tasks:[{title:'A',state:'open',owner:null,due:'2026-10-20'}]},{id:'2',status:'withdrawn',tasks:[{title:'B',state:'open',owner:null,due:'2026-10-20'}]}];const r=buckets(apps,'2026-10-29');assert.equal(r.length,1);assert.deepEqual(r[0].flags,['Overdue','Unassigned'])});

test('deficiency inbox excludes verified and withdrawn work and preserves identity',()=>{
 const apps=[
  {id:'one',status:'active',business:'Twin Name',reference:'REF-1',owner:'Alex',stage:'Intake',
   tasks:[],deficiencies:[{id:'D1',description:'Proof of address',verification:'unverified',due:'2026-10-20'}]},
  {id:'two',status:'active',business:'Twin Name',reference:'REF-2',owner:'Morgan',stage:'Review',
   tasks:[],deficiencies:[{id:'D2',description:'Signed declaration',verification:'received',response:'Received',due:null}]},
  {id:'three',status:'withdrawn',stage:'Intake',tasks:[],deficiencies:[{id:'D3',verification:'unverified',due:'2026-10-01'}]},
  {id:'four',status:'active',stage:'Intake',tasks:[],deficiencies:[{id:'D4',verification:'verified',due:'2026-10-01'}]}
 ];
 const items=deficiencyInbox(apps,'2026-10-30');
 assert.equal(items.length,2);
 assert.deepEqual(items.map(x=>x.reference),['REF-1','REF-2']);
 assert.equal(items[0].overdue,true);
 assert.equal(items[0].nextAction,'Request or obtain evidence');
 assert.equal(items[1].overdue,false);
 assert.equal(items[1].nextAction,'Review and verify response');
 assert.equal(items[1].due,null);
});
test('portfolio counts unresolved work per stage without resurrecting withdrawn applications',()=>{
 const apps=[
  {id:'A',status:'active',stage:'Intake',tasks:[{state:'completed'},{state:'blocked'}],deficiencies:[{verification:'unverified'}]},
  {id:'B',status:'active',stage:'Review',tasks:[{state:'open'}],deficiencies:[{verification:'verified'}]},
  {id:'C',status:'withdrawn',stage:'Intake',tasks:[{state:'open'}],deficiencies:[{verification:'unverified'}]}
 ];
 const p=portfolio(apps);
 assert.equal(p.length,5);
 assert.deepEqual(p.find(s=>s.stage==='Intake'),{stage:'Intake',count:1,openTasks:1,openDeficiencies:1,caseIds:['A']});
 assert.deepEqual(p.find(s=>s.stage==='Review'),{stage:'Review',count:1,openTasks:1,openDeficiencies:0,caseIds:['B']});
});
