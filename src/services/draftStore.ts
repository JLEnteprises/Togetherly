type Storage = { getItem(key:string):Promise<string|null>; setItem(key:string,value:string):Promise<void>; removeItem(key:string):Promise<void> };
export function createDraftStore(storage: Storage) {
  const writes = new Map<string, Promise<void>>();
  function enqueue(key:string, action:()=>Promise<void>) {
    const next=(writes.get(key) ?? Promise.resolve()).catch(()=>undefined).then(action);
    writes.set(key,next);
    void next.finally(()=> { if(writes.get(key)===next) writes.delete(key); }).catch(()=>undefined);
    return next;
  }
  return {
    async read(key:string) { await writes.get(key)?.catch(()=>undefined); return storage.getItem(key); },
    write(key:string,value:string) { return enqueue(key,()=>storage.setItem(key,value)); },
    remove(key:string) { return enqueue(key,()=>storage.removeItem(key)); },
  };
}
