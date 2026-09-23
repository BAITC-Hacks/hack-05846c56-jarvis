import fs from 'node:fs';
process.loadEnvFile('.env.local');
const base=process.env.EKT_API_URL.replace(/\/$/,'');
const headers={Authorization:'Basic '+Buffer.from(`${process.env.EKT_API_USERNAME}:${process.env.EKT_API_PASSWORD}`).toString('base64')};
const get=async(path)=>{for(let i=0;i<3;i++){try{const r=await fetch(base+path,{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return await r.json()}catch(e){if(i===2)throw e;}}};
const products=new Map();
for(const page of [1,2,20,50,100,170,190,200,230,250,260,300,350,400,450,500,550,600,650,700,750]){
 const d=await get('/products?page='+page);console.log('page',page,d.items?.[0]?.name);
 for(const p of (d.items||[]).filter((_,i)=>page<=2||i%2===0))products.set(String(p.id),p);
}
const detailed=[];const list=[...products.values()];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<list.length){const p=list[cursor++];try{const d=await get('/products/detail?id='+p.id);detailed.push({...d,_fetchedAt:new Date().toISOString()})}catch{console.log('detail failed',p.id)}}}));
detailed.sort((a,b)=>a.id-b.id);fs.writeFileSync('data/catalog-snapshot.json',JSON.stringify({fetchedAt:new Date().toISOString(),source:'https://ekt.kz/api/products',items:detailed},null,2));console.log('saved',detailed.length);

