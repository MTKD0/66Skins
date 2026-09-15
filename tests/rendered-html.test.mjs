import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the restored 66SKINS homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /66SKINS/);
  assert.match(html, /经典盲盒/);
  assert.match(html, /幸运饰品/);
  assert.match(html, /ROLL房/);
  assert.match(html, /商城/);
  assert.match(html, /盲盒消费提示/);
  assert.match(html, /最近掉落/);
  assert.match(html, /等待接入数据/);
  assert.match(html, /每日/);
  assert.match(html, /幸运玩家/);
});

test("renders the classic box grid", async () => {
  const response = await render("/classic-box");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /经典盲盒/);
  assert.match(html, /掉落记录/);
  assert.match(html, /采石场/);
  assert.match(html, /赤色试炼/);
  assert.match(html, /浮光掠影/);
  assert.doesNotMatch(html, /五五开|三七开|一九开/);
});

test("renders the lucky accessory homepage", async () => {
  const response = await render("/lucky");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /热门道具/);
  assert.match(html, /掉落记录/);
  assert.match(html, /全局统计/);
  assert.match(html, /爪子刀/);
  assert.match(html, /价格从低到高/);
  assert.match(html, /请输入道具名称/);
});

test("renders the lucky accessory opening detail", async () => {
  const response = await render("/lucky/detail?item=8");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /成功/);
  assert.match(html, /失败/);
  assert.doesNotMatch(html, /真实判定|动画按 20 格四舍五入|问号约|成功约/);
  assert.match(html, /同款品质/);
  assert.match(html, /战痕累累/);
  assert.match(html, /久经沙场/);
  assert.match(html, /崭新出厂/);
  assert.match(html, /最近掉落/);
  assert.match(html, /还没有打开记录/);
});

test("renders the classic box opening detail", async () => {
  const response = await render("/classic-box/detail?box=5");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /致命空枪/);
  assert.match(html, /物品列表/);
  assert.match(html, /历史掉落/);
  assert.match(html, /掉落统计/);
  assert.match(html, /类型统计/);
  assert.match(html, /跳过动画/);
  assert.match(html, /游戏说明/);
  assert.match(html, /等待接入数据/);
});

test("renders the local backpack and trade settings", async () => {
  const response = await render("/backpack");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /steam交易设置/);
  assert.match(html, /我的背包/);
  assert.match(html, /取回记录/);
  assert.match(html, /全选/);
  assert.match(html, /已经选择/);
  assert.match(html, /本地纪念版只保存链接格式/);
});
