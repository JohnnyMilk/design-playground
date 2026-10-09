// The main-branch JSON is authoritative for both GitHub Pages and Sites.
export const STATIONS_URL='https://raw.githubusercontent.com/JohnnyMilk/design-playground/main/flexfill/dist/stations.json';
const IDS=['01','02','03','04','05'];
export function validateStations(data){
 if(!data||!Array.isArray(data.stations)||data.stations.length!==5)throw Error('Expected five stations');
 return IDS.map(id=>{
  const matches=data.stations.filter(s=>s&&s.id===id);
  if(matches.length!==1)throw Error('Missing or duplicate station '+id);
  const s=matches[0];
  if(typeof s.name!=='string'||!s.name.trim()||typeof s.description!=='string'||!s.description.trim())throw Error('Invalid station '+id);
  return {id,name:s.name,description:s.description};
 });
}
export function escapeText(text){return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function read(url,fetcher){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const r=await fetcher(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return validateStations(await r.json());}
 finally{clearTimeout(timer);}
}
export async function loadStationContent(fetcher=fetch){
 try{return {stations:await read(STATIONS_URL+'?t='+Date.now(),fetcher),warning:''};}
 catch{
  try{return {stations:await read('./stations.json?t='+Date.now(),fetcher),warning:'GitHub 最新文字暫時無法讀取，正在顯示此網站隨附的版本；請稍後重新整理。'};}
  catch{return {stations:IDS.map(id=>({id,name:'工站 '+id,description:'工站文字暫時無法讀取，請確認 stations.json 格式後重新整理。'})),warning:'工站文字載入失敗。請確認 stations.json 的 JSON 格式，以及五個工站的 id、name、description。'};}
 }
}
