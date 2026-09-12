import assert from 'node:assert/strict';
import { Outbox, type Row } from '../src/services/offline/outbox';
async function main() {
const values = new Map<string,string>();
const storage = { async getItem(k:string) { return values.get(k) ?? null; }, async setItem(k:string,v:string){ values.set(k,v); } };
const box = new Outbox(storage,'user-couple','u','c',()=>{}); await box.ready;
await box.snapshot('/tasks',{tasks:[]});
const created = await box.enqueue('/tasks','POST',{title:'Offline',subtasks:[{title:'First'}]});
const local = box.project('/tasks').tasks[0];
await box.enqueue(`/task-subtasks/${local.subtasks[0].id}`,'PATCH',{completed:true});
await box.enqueue(`/tasks/${local.id}`,'PATCH',{status:'completed',updatedAt:local.updated_at});
const restored = new Outbox(storage,'user-couple','u','c',()=>{});await restored.ready;
assert.equal(restored.pending,3);assert.equal(restored.project('/tasks').tasks[0].status,'completed');
assert.equal(restored.project('/tasks').tasks[0].subtasks[0].completed,true);
let lost = true; const receipts = new Map<string,Row>(); let creations=0;
const send = async (p:Row) => {
  if(receipts.has(p.id)) return receipts.get(p.id);
  let result:Row;
  if(p.method==='POST') { creations++; result={task:{...created.optimistic,id:'remote-task',updated_at:'2026-09-12T00:00:00.000Z',subtasks:[{...local.subtasks[0],id:'remote-step',task_id:'remote-task',updated_at:'2026-09-12T00:00:00.000Z'}]}}; }
  else if(p.path.startsWith('/task-subtasks/')) {assert.equal(p.path,'/task-subtasks/remote-step'); result={subtask:{id:'remote-step',task_id:'remote-task',completed:true,updated_at:'2026-09-12T00:01:00.000Z'}};}
  else {assert.equal(p.path,'/tasks/remote-task');assert.equal(p.body.updatedAt,'2026-09-12T00:00:00.000Z');result={task:{...created.optimistic,id:'remote-task',status:'completed',updated_at:'2026-09-12T00:02:00.000Z'}};}
  const receipt={result};receipts.set(p.id,receipt);if(lost){lost=false;throw Object.assign(new Error('Response lost'),{status:0});}return receipt;
};
await assert.rejects(restored.flush(send,()=>true));
const restarted = new Outbox(storage,'user-couple','u','c',()=>{});await restarted.ready;
await restarted.flush(send,()=>true);assert.equal(creations,1);assert.equal(restarted.pending,0);
assert.equal(restarted.project('/tasks').tasks[0].id,'remote-task');
const another = new Outbox(storage,'other-user-couple','x','c',()=>{});await another.ready;assert.equal(another.pending,0);
const conflict = await restarted.enqueue('/tasks/remote-task','PATCH',{title:'Conflict'});
await assert.rejects(restarted.flush(async()=>{throw Object.assign(new Error('Changed by partner'),{status:409});},()=>true));
assert.equal(restarted.pending,1);assert.equal(restarted.problem,'Changed by partner');
assert.equal(restarted.project('/tasks').tasks[0].title,'Conflict');
await restarted.discardAll();assert.equal(restarted.project('/tasks').tasks[0].title,'Offline');
const broken = new Outbox({...storage, async setItem(){throw new Error('Disk full');}},'broken','u','c',()=>{});await broken.ready;
await assert.rejects(broken.enqueue('/notes','POST',{title:'Never saved'}));assert.equal(broken.pending,0);
// Multiple revisions authored by this device can be rebased without treating
// a queued edit as a conflicting partner change.
const chain = new Outbox(storage,'chain','u','c',()=>{}); await chain.ready;
await chain.snapshot('/notes',{notes:[{id:'note',title:'Original',updated_at:'v0'}]});
await chain.enqueue('/notes/note','PATCH',{title:'First'});
await chain.flush(async () => ({result:{note:{id:'note',title:'First',updated_at:'v1'}}}),()=>true);
await chain.enqueue('/notes/note','PATCH',{title:'Second',updatedAt:'v0'});
await chain.enqueue('/notes/note','PATCH',{title:'Third',updatedAt:'v1'});
let revision = 1;
await chain.flush(async payload => {
  assert.equal(payload.body.updatedAt, `v${revision}`);
  revision++;
  return {result:{note:{id:'note',title:payload.body.title,updated_at:`v${revision}`}}};
},()=>true);
assert.equal(chain.project('/notes').notes[0].title,'Third');
console.log('PASS durable restart, response-loss retry, dependent IDs and steps, revisions, account isolation, conflict retention/discard and storage failure');

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
