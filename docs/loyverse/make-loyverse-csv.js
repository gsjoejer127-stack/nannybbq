// 从 index.html 的 CATALOG 生成 Loyverse 批量导入 CSV
// 用法：node docs/loyverse/make-loyverse-csv.js  （改价后重跑即可）
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const src=html.slice(html.indexOf('var CATALOG = {'),html.indexOf('var ORDER ='));
const c=new Function(src+';return CATALOG;')();
const CAT={skewers:"冷冻烤串 Frozen Skewers",balls:"丸子鱼饼 Balls & Fish Cakes",meat:"涮肉片 Sliced Meats",soup:"汤底 Soup Base",grill:"烧烤架炉具 Grill & Cooker",season:"调味刷酱 Seasoning & Sauces",supplies:"烧烤用品 Supplies",extras:"其他好物 Extras",pack:"超值配套 Value Package"};
const H=["Handle","SKU","Name","Category","Description","Sold by weight","Option 1 name","Option 1 value","Option 2 name","Option 2 value","Option 3 name","Option 3 value","Default price","Cost","Barcode","SKU of included item","Quantity of included item","Track stock"];
const out=[H];
const q=v=>{v=v==null?"":String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
const row=o=>H.map(h=>o[h]??"");
const spec=r=>r.spec+(r.sub?" ("+r.sub+")":"");
for(const k in c)for(const p of c[k]){
  const name=(p.cn+" "+p.en).slice(0,64);
  const base={Handle:p.id,Name:name,Category:CAT[k],"Sold by weight":"N","Track stock":"N"};
  const vars=p.rows.map((r,i)=>({v:p.rows.length>1?r.spec:spec(r),price:r.price,sku:p.rows.length>1?p.id+"-"+(i+1):p.id}));
  if(p.bundle){ // 网站上的“凑数优惠”在 Loyverse 里做成独立规格
    const u=p.bundle.unit; vars.push({v:(p.rows.length>1?"任选 ":"")+p.bundle.n+" "+u+" Bundle",price:p.bundle.price,sku:p.id+"-b"+p.bundle.n});
    if(p.rows.length===1) vars[0].sku=p.id+"-1";
  }
  const desc=(vars.length===1?vars[0].v+"。":"")+(p.desc||"")+(p.halal?" [Halal]":"");
  vars.forEach((x,i)=>{
    const o={...base,SKU:x.sku,"Default price":x.price.toFixed(2)};
    if(i===0)o.Description=desc;
    if(vars.length>1){o["Option 1 name"]="规格 Size";o["Option 1 value"]=x.v.slice(0,64);}
    if(i>0){o.Name=name;}
    out.push(row(o));
  });
}
const P=[["pk03","超值 6–8 人烧烤配套 Value BBQ Set 6–8 pax",688,"6–8 人份：9 款烤串各 2 包共 340 串、小馒头棉花糖各 2 包、黑炭 2kg、调味粉与蒜蓉酱，再免费送烧烤架 1 套和大礼包 1 套。"],
["pk02","超值 6–8 人双拼配套 BBQ + Hotpot Set 6–8 pax",688,"6–8 人份：170 串烤串、丸子鱼饼、小馒头棉花糖，鸳鸯锅两味汤底加 1.2kg 肉片和 7 款丸子，配烧烤架、黑炭 2kg、卡式炉 + 4 罐气，再免费送 6 样烧烤用品。"],
["pk01","超值 10–15 人双拼配套 BBQ + Hotpot Set 10–15 pax",1288,"10–15 人份：360 串烤串、4kg 丸子鱼饼、1.6kg 涮肉片，加 2 个烤架、2 套卡式炉、4kg 黑炭，再免费送 10 样（含两味汤底）。"]];
for(const [id,n,pr,d] of P) out.push(row({Handle:id,SKU:id,Name:n.slice(0,64),Category:CAT.pack,Description:d,"Sold by weight":"N","Default price":pr.toFixed(2),"Track stock":"N"}));
fs.writeFileSync(path.join(__dirname,'loyverse-items-import.csv'),"﻿"+out.map(r=>r.map(q).join(",")).join("\r\n")+"\r\n");
console.log(out.length-1,"rows");
