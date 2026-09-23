import fs from 'node:fs';
process.loadEnvFile('.env.local');
const base=process.env.EKT_API_URL.replace(/\/$/,'');
const headers={Authorization:'Basic '+Buffer.from(`${process.env.EKT_API_USERNAME}:${process.env.EKT_API_PASSWORD}`).toString('base64')};
const products=new Map();let page=1;let failures=0;
await Promise.all(Array.from({length:5},async()=>{while(page<=760){const n=page++;try{const r=await fetch(base+'/products?page='+n,{headers,signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error();const d=await r.json();for(const p of d.items||[])products.set(String(p.id),{id:p.id,name:p.name,article:p.article,url:p.url,image:p.image,price:p.price});if(n%100===0)console.log('indexed pages',n,'products',products.size);}catch{failures++;}}}));
fs.writeFileSync('data/catalog-index.json',JSON.stringify({fetchedAt:new Date().toISOString(),items:[...products.values()]},null,0));console.log('Full index products',products.size,'failed pages',failures);
