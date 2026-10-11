// 通过 Loyverse API 直接把网站商品建进 POS（分类 + 商品 + 规格 + 各门店价格）
// 用法：LOYVERSE_TOKEN=xxx node docs/loyverse/push-to-loyverse.js [--dry]
// 已存在的 SKU 会跳过，可重复运行
const fs=require('fs'),path=require('path');
const API='https://api.loyverse.com/v1.0';
const TOKEN=process.env.LOYVERSE_TOKEN, DRY=process.argv.includes('--dry');
const html=fs.readFileSync(process.argv.find(a=>a.endsWith('.html'))||path.join(__dirname,'..','..','index.html'),'utf8');
const c=new Function(html.slice(html.indexOf('var CATALOG = {'),html.indexOf('var ORDER ='))+';return CATALOG;')();
const CAT={skewers:"冷冻烤串 Frozen Skewers",balls:"丸子鱼饼 Balls & Fish Cakes",meat:"涮肉片 Sliced Meats",soup:"汤底 Soup Base",grill:"烧烤架炉具 Grill & Cooker",season:"调味刷酱 Seasoning & Sauces",supplies:"烧烤用品 Supplies",extras:"其他好物 Extras",pack:"超值配套 Value Package"};
const COLOR={skewers:"RED",balls:"ORANGE",meat:"PINK",soup:"YELLOW",grill:"GREY",season:"GREEN",supplies:"BLUE",extras:"GREEN",pack:"PURPLE"};
const spec=r=>r.spec+(r.sub?" ("+r.sub+")":"");
const items=[];
for(const k in c)for(const p of c[k]){
  const multi=p.rows.length>1;
  const v=p.rows.map((r,i)=>({sku:multi?p.id+"-"+(i+1):p.id,opt:multi?r.spec:null,price:r.price}));
  if(p.bundle){v.push({sku:p.id+"-b"+p.bundle.n,opt:(multi?"任选 ":"")+p.bundle.n+" "+p.bundle.unit+" Bundle",price:p.bundle.price});if(!multi){v[0].sku=p.id+"-1";v[0].opt=spec(p.rows[0]);}}
  const desc=(!multi&&!p.bundle?spec(p.rows[0])+"。":"")+(p.desc||"")+(p.halal?" [Halal]":"");
  items.push({cat:k,name:(p.cn+" "+p.en).slice(0,64),desc,v});
}
[["pk03","超值 6–8 人烧烤配套 Value BBQ Set 6–8 pax",688],["pk02","超值 6–8 人双拼配套 BBQ + Hotpot Set 6–8 pax",688],["pk01","超值 10–15 人双拼配套 BBQ + Hotpot Set 10–15 pax",1288]]
  .forEach(([id,n,pr])=>{const m=html.match(new RegExp('id: "'+id+'"[\\s\\S]*?descCn: "([^"]*)"'));items.push({cat:"pack",name:n,desc:m?m[1]:"",v:[{sku:id,opt:null,price:pr}]});});

async function api(method,p,body){
  for(let t=0;t<5;t++){
    const r=await fetch(API+p,{method,headers:{Authorization:"Bearer "+TOKEN,"Content-Type":"application/json"},body:body&&JSON.stringify(body)});
    if(r.status===429){await new Promise(s=>setTimeout(s,2000*(t+1)));continue;}
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(method+" "+p+" → "+r.status+" "+JSON.stringify(j));
    return j;
  }
}
async function all(p,key){let out=[],cur;do{const j=await api("GET",p+(p.includes("?")?"&":"?")+"limit=250"+(cur?"&cursor="+cur:""));out=out.concat(j[key]||[]);cur=j.cursor;}while(cur);return out;}

(async()=>{
  console.log(items.length,"items /",items.reduce((s,i)=>s+i.v.length,0),"variants");
  if(DRY){console.log(JSON.stringify(items,null,1));return;}
  if(!TOKEN)throw new Error("缺少 LOYVERSE_TOKEN");
  const stores=await all("/stores","stores");
  console.log("stores:",stores.map(s=>s.name).join(", "));
  const cats=await all("/categories","categories"), catId={};
  for(const k in CAT){let x=cats.find(z=>z.name===CAT[k]);if(!x)x=await api("POST","/categories",{name:CAT[k],color:COLOR[k]});catId[k]=x.id;}
  const have=new Set((await all("/items","items")).flatMap(i=>(i.variants||[]).map(v=>v.sku)));
  let made=0,skip=0;
  for(const it of items){
    if(it.v.every(v=>have.has(v.sku))){skip++;continue;}
    const body={item_name:it.name,description:it.desc,category_id:catId[it.cat],track_stock:false,sold_by_weight:false,is_composite:false,
      variants:it.v.map(v=>({sku:v.sku,option1_value:v.opt||undefined,default_pricing_type:"FIXED",default_price:v.price,
        stores:stores.map(s=>({store_id:s.id,pricing_type:"FIXED",price:v.price,available_for_sale:true}))}))};
    if(it.v.length>1)body.option1_name="规格 Size";
    await api("POST","/items",body);made++;console.log("✓",it.name);
  }
  // 核对
  const after=await all("/items","items"), skus=new Map(after.flatMap(i=>(i.variants||[]).map(v=>[v.sku,v.default_price])));
  const bad=items.flatMap(i=>i.v).filter(v=>skus.get(v.sku)!==v.price);
  console.log(`新建 ${made}，跳过 ${skip}；核对 ${bad.length?"有问题: "+JSON.stringify(bad):"全部 SKU 和价格一致"}`);
})().catch(e=>{console.error(e.message);process.exit(1);});
