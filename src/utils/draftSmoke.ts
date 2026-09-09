const assert = { equal(actual:unknown, expected:unknown) { if(actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`); }, async rejects(promise:Promise<unknown>) { let failed=false; try { await promise; } catch { failed=true; } if(!failed) throw new Error('Expected rejected write'); } };
import { createDraftStore } from '../services/draftStore';
async function main() {
  const values=new Map<string,string>();
  let release!:()=>void;
  const gate=new Promise<void>((resolve)=> {release=resolve;});
  const store=createDraftStore({
    async getItem(key){return values.get(key) ?? null;},
    async setItem(key,value){if(value==='first') await gate; if(value==='fail') throw new Error('Disk full'); values.set(key,value);},
    async removeItem(key){values.delete(key);},
  });
  const first=store.write('user:couple:task','first');
  const second=store.write('user:couple:task','second');
  await store.write('other:couple:task','separate');
  assert.equal(await store.read('other:couple:task'),'separate');
  release(); await Promise.all([first,second]);
  assert.equal(await store.read('user:couple:task'),'second');
  const pending=store.write('user:couple:task','latest');
  const remove=store.remove('user:couple:task');
  await Promise.all([pending,remove]); assert.equal(await store.read('user:couple:task'),null);
  await assert.rejects(store.write('user:couple:task','fail'));
  await store.write('user:couple:task','recovered');
  assert.equal(await store.read('user:couple:task'),'recovered');
  assert.equal(await store.read('other:couple:task'),'separate');
  console.log('PASS draft ordering, isolated accounts, discard after pending writes, and failed-write recovery');
}
void main().catch((error)=> { console.error(error); process.exitCode=1; });
