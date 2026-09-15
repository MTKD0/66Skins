import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const accessories = JSON.parse(fs.readFileSync(new URL("../data/accessories.seed.json", import.meta.url), "utf8"));

test("contains the imported Chinese CS2 accessory catalog", () => {
  assert.equal(accessories.length, 2126);
  assert.ok(accessories.every((item) => item.id && item.name && item.imageUrl));
  assert.ok(accessories.every((item) => item.imageUrl.startsWith("https://")));
});

test("keeps category, rarity, wear, and source metadata", () => {
  const sample = accessories.find((item) => item.name.includes("AK-47"));
  assert.ok(sample);
  assert.ok(sample.categoryName);
  assert.ok(sample.rarityName);
  assert.ok(Array.isArray(sample.wears));
  assert.equal(sample.source, "ByMykel/CSGO-API");
});
