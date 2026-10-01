export const uuid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
export const TYPES={P:'Porte',G:'Garage',B:'Boîte aux lettres',C:'Cadenas / Antivol',T:'Local technique',V:'Véhicule',S:'Stockage / cave'};
export function keyCode(site,lock,copy){return `${site?.number??'?'}${lock?.type??'?'}${lock?.number??'?'}${copy??'?'}`}
export function downloadJSON(obj,name){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
