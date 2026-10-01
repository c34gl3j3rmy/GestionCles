/* Analyse volontairement orientée identification : les coordonnées métriques et le contour brut ne sont jamais persistés. */
export async function analyzeImage(file){
  const bitmap=await createImageBitmap(file); const max=1200; const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const c=document.createElement('canvas'); c.width=Math.round(bitmap.width*scale); c.height=Math.round(bitmap.height*scale); const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(bitmap,0,0,c.width,c.height); bitmap.close();
  const d=x.getImageData(0,0,c.width,c.height); let dark=0,edge=0; for(let y=1;y<c.height-1;y+=3){for(let xx=1;xx<c.width-1;xx+=3){const i=(y*c.width+xx)*4;const l=.2126*d.data[i]+.7152*d.data[i+1]+.0722*d.data[i+2];if(l<95)dark++;const j=(y*c.width+xx+1)*4;const l2=.2126*d.data[j]+.7152*d.data[j+1]+.0722*d.data[j+2];if(Math.abs(l-l2)>45)edge++;}}
  const samples=Math.ceil((c.height-2)/3)*Math.ceil((c.width-2)/3); const contrast=Math.min(1,(dark/samples)*5); const detail=Math.min(1,(edge/samples)*18); const quality=Math.round((contrast*.45+detail*.55)*100);
  // V1 : empreinte non réversible dérivée de l'image pour aider au tri. Le module est versionné pour remplacement par le détecteur géométrique validé sur les vraies prises de vue.
  const tiny=document.createElement('canvas');tiny.width=16;tiny.height=16;const t=tiny.getContext('2d');t.drawImage(c,0,0,16,16);const td=t.getImageData(0,0,16,16).data;const lum=[];for(let i=0;i<td.length;i+=4)lum.push((td[i]+td[i+1]+td[i+2])/3);const avg=lum.reduce((a,b)=>a+b,0)/lum.length;const bits=lum.map(v=>v>avg?1:0);const vector=[];for(let i=0;i<32;i++){let n=0;for(let b=0;b<8;b++)n=(n<<1)|bits[i*8+b];vector.push(n/255)}
  return {analysisVersion:1,quality,vector,valleyCount:null,variationSimple:null,variationDetailed:[],mainValley:null,createdAt:new Date().toISOString(),note:'Empreinte visuelle V1. Détection géométrique des creux à étalonner.'};
}
export function similarity(a,b){if(!a?.vector||!b?.vector)return 0;const n=Math.min(a.vector.length,b.vector.length);let e=0;for(let i=0;i<n;i++)e+=Math.abs(a.vector[i]-b.vector[i]);return Math.max(0,1-e/n)}
export function label(score){return score>=.9?'TRÈS FORTE':score>=.75?'FORTE':score>=.55?'MOYENNE':'FAIBLE'}
