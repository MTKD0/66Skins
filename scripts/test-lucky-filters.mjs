import assert from "node:assert/strict";

const base = "http://localhost:3001";
async function list(params = {}, expectedStatus = 200) {
  const response = await fetch(`${base}/api/lucky-accessories?${new URLSearchParams(params)}`);
  const data = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(data));
  return data;
}

const categories = {glove:"手套",knife:"匕首",pistol:"手枪",smg:"微型冲锋枪",rifle:"步枪",sniper:"步枪",ultimate:"重型武器"};
const snipers = new Set(["AWP","SSG 08","G3SG1","SCAR-20"]);
for (const [category, name] of Object.entries(categories)) {
  const result = await list({category});
  assert.ok(result.total > 0, category);
  assert.ok(result.rows.length > 0 && result.rows.length <= 20);
  assert.ok(result.rows.every(row => row.categoryName === name));
  if (category === "sniper") assert.ok(result.rows.every(row => snipers.has(row.weaponName)));
  if (category === "rifle") assert.ok(result.rows.every(row => !snipers.has(row.weaponName)));
  const weapon = result.types[0];
  const subtype = await list({category,weapon});
  assert.ok(subtype.total > 0);
  assert.ok(subtype.rows.every(row => row.weaponName === weapon && row.categoryName === name));
}
console.log("PASS all categories, category-specific subtypes, rifle/sniper separation");

const knife = await list({category:"knife",weapon:"爪子刀"});
assert.ok(knife.rows.length > 0);
assert.ok(knife.rows.every(row => row.weaponName === "爪子刀"));
const first = await list({category:"recommend",min:"1",max:"200",sort:"asc"});
const second = await list({category:"recommend",min:"1",max:"200",sort:"asc",page:"1"});
assert.ok(first.total > 20);
const rows = [...first.rows,...second.rows];
assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
assert.ok(rows.every(row=>row.priceTokens>=1 && row.priceTokens<=200));
assert.ok(rows.every((row,index)=>index===0 || row.priceTokens>=rows[index-1].priceTokens));
const descending = await list({category:"recommend",min:"1",max:"200",sort:"desc"});
assert.equal(descending.total,first.total);
assert.ok(descending.rows.every((row,index)=>index===0 || row.priceTokens<=descending.rows[index-1].priceTokens));
const sample=knife.rows.find(row=>row.priceTokens>0);
assert.ok(sample);
const exact=await list({category:"knife",weapon:"爪子刀",q:sample.name,min:String(sample.priceTokens),max:String(sample.priceTokens)});
assert.ok(exact.rows.some(row=>row.id===sample.id));
assert.ok(exact.rows.every(row=>row.priceTokens===sample.priceTokens && row.name.includes(sample.name)));
assert.equal((await list({category:"glove",weapon:"AK-47"})).total,0);
assert.equal((await list({q:"nonexistentitemqaverification"})).total,0);
assert.equal((await list({q:"%_"})).total,0);
for(const params of [{category:"unknown"},{min:"abc"},{min:"-1"},{min:"200",max:"1"},{page:"-1"}]) await list(params,400);
console.log("PASS combined name/type/price filters, literal search, sorting, pagination, empty and invalid inputs");

const detailResponse=await fetch(`${base}/api/accessories?id=${encodeURIComponent(sample.id)}&variants=1&databaseOnly=1`);
assert.equal(detailResponse.status,200);
const detail=await detailResponse.json();
assert.equal(detail.item.id,sample.id);
assert.equal(detail.item.name,sample.name);
assert.equal(detail.item.priceTokens,sample.priceTokens);
assert.ok(detail.variants.every(variant=>variant.priceTokens===Math.round(variant.priceCny/6.5*100)/100));
console.log("PASS selected accessory identity and database prices in detail response");
