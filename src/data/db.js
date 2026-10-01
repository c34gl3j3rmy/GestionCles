const DB_NAME='key-inventory'; const DB_VERSION=1;
const stores=['sites','locks','keys','loans','events','signatures'];
let dbPromise;
export function openDB(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{const db=r.result;for(const name of stores){if(!db.objectStoreNames.contains(name)){const s=db.createObjectStore(name,{keyPath:'id'});if(name==='keys')s.createIndex('lockId','lockId');if(name==='loans')s.createIndex('keyId','keyId');if(name==='events')s.createIndex('entityId','entityId');}}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbPromise}
async function store(name,mode='readonly'){return (await openDB()).transaction(name,mode).objectStore(name)}
export async function all(name){const s=await store(name);return new Promise((res,rej)=>{const r=s.getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
export async function get(name,id){const s=await store(name);return new Promise((res,rej)=>{const r=s.get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
export async function put(name,value){const s=await store(name,'readwrite');return new Promise((res,rej)=>{const r=s.put(value);r.onsuccess=()=>res(value);r.onerror=()=>rej(r.error)})}
export async function remove(name,id){const s=await store(name,'readwrite');return new Promise((res,rej)=>{const r=s.delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
export async function clear(name){const s=await store(name,'readwrite');return new Promise((res,rej)=>{const r=s.clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
export async function exportDB(){const data={schemaVersion:1,exportedAt:new Date().toISOString(),data:{}};for(const n of stores)data.data[n]=await all(n);return data}
export async function importDB(payload){if(payload?.schemaVersion!==1||!payload.data)throw new Error('Format de sauvegarde incompatible');for(const n of stores){await clear(n);for(const item of payload.data[n]||[])await put(n,item)}}
export {stores};
