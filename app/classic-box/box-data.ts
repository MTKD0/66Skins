export type Tier = "blue" | "red" | "green";

export type ClassicBox = {
  id: number;
  accessoryId: string;
  name: string;
  price: string;
  itemValue: string;
  priceCny?: number;
  priceSource?: string;
  priceUpdatedAt?: string;
  preferredExterior: string;
  marketHashName: string;
  marketSearchName?: string;
  tier: Tier;
  winRate: number;
  weaponSrc: string;
  weaponName: string;
};

export const boxAssets: Record<Tier, string> = {
  blue: "/assets/classic-box/box-blue-layer.png",
  red: "/assets/classic-box/box-red-layer.png",
  green: "/assets/classic-box/box-green-layer.png",
};

export const boxes: ClassicBox[] = [
  { id: 1, accessoryId: "skin-236347a195bd", name: "采石场", price: "", itemValue: "", preferredExterior: "略有磨损", marketHashName: "P90 | Cold Blooded (Minimal Wear)", tier: "blue", winRate: 0.5, weaponSrc: "/assets/classic-box/weapons/weapon-01.png", weaponName: "P90 | 冷血杀手" },
  { id: 2, accessoryId: "skin-9a0273275e44", name: "蓝色脉冲", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "SSG 08 | Azure Glyph (Field-Tested)", tier: "blue", winRate: 0.5, weaponSrc: "/assets/classic-box/weapons/weapon-02.png", weaponName: "SSG 08 | 碧蓝雕文" },
  { id: 3, accessoryId: "skin-d2ff95e10b1f", name: "碰一碰", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "USP-S | Blueprint (Field-Tested)", marketSearchName: "USP 消音版 | 蓝图", tier: "blue", winRate: 0.5, weaponSrc: "/assets/classic-box/weapons/weapon-03.png", weaponName: "USP消音版 | 蓝图" },
  { id: 4, accessoryId: "skin-6747a1a6fb43", name: "全甲沙鹰", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "Desert Eagle | Cobalt Disruption (Field-Tested)", tier: "blue", winRate: 0.5, weaponSrc: "/assets/classic-box/weapons/weapon-04.png", weaponName: "沙漠之鹰 | 钴蓝禁锢" },
  { id: 5, accessoryId: "skin-e400418cedad", name: "致命空枪", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "MP9 | Cobalt Paisley (Field-Tested)", tier: "blue", winRate: 0.5, weaponSrc: "/assets/classic-box/weapons/weapon-05.png", weaponName: "MP9 | 钴蓝佩斯利" },
  { id: 6, accessoryId: "skin-07d3aad223e4", name: "赤色试炼", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "M4A4 | Steel Work (Field-Tested)", tier: "red", winRate: 0.3, weaponSrc: "/assets/classic-box/weapons/weapon-06.png", weaponName: "M4A4 | 钢铁红流" },
  { id: 7, accessoryId: "skin-91a429af4a60", name: "烈焰前线", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "AK-47 | Redline (Field-Tested)", tier: "red", winRate: 0.3, weaponSrc: "/assets/classic-box/weapons/weapon-07.png", weaponName: "AK-47 | 红线" },
  { id: 8, accessoryId: "skin-5c4c6649f0ba", name: "红线追踪", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "AWP | Redline (Field-Tested)", tier: "red", winRate: 0.3, weaponSrc: "/assets/classic-box/weapons/weapon-08.png", weaponName: "AWP | 红线" },
  { id: 9, accessoryId: "skin-7562e4bd91c7", name: "熔火核心", price: "", itemValue: "", preferredExterior: "略有磨损", marketHashName: "M4A1-S | Hot Rod (Minimal Wear)", marketSearchName: "M4A1 消音型 | 赤红新星", tier: "red", winRate: 0.3, weaponSrc: "/assets/classic-box/weapons/weapon-09.png", weaponName: "M4A1消音版 | 赤红新星" },
  { id: 10, accessoryId: "skin-4e5b581684d4", name: "破晓先锋", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "Glock-18 | Candy Apple (Field-Tested)", marketSearchName: "格洛克 18 型 | 红苹果", tier: "red", winRate: 0.3, weaponSrc: "/assets/classic-box/weapons/weapon-10.png", weaponName: "格洛克18型 | 红苹果" },
  { id: 11, accessoryId: "skin-07b30f648b35", name: "曙光", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "AUG | Carved Jade (Field-Tested)", tier: "green", winRate: 0.1, weaponSrc: "/assets/classic-box/weapons/weapon-11.png", weaponName: "AUG | 璞玉" },
  { id: 12, accessoryId: "skin-5a552bf64f59", name: "星芒", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "UMP-45 | Day Lily (Field-Tested)", tier: "green", winRate: 0.1, weaponSrc: "/assets/classic-box/weapons/weapon-12.png", weaponName: "UMP-45 | 忘忧草" },
  { id: 13, accessoryId: "skin-5af9f375159d", name: "光谱仪", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "FAMAS | Eye of Athena (Field-Tested)", tier: "green", winRate: 0.1, weaponSrc: "/assets/classic-box/weapons/weapon-13.png", weaponName: "法玛斯 | 雅典娜之眼" },
  { id: 14, accessoryId: "skin-5b9f03255b9d", name: "驹光过隙", price: "", itemValue: "", preferredExterior: "久经沙场", marketHashName: "Nova | Green Apple (Field-Tested)", tier: "green", winRate: 0.1, weaponSrc: "/assets/classic-box/weapons/weapon-14.png", weaponName: "新星 | 绿苹果" },
  { id: 15, accessoryId: "skin-a07ae9bbbeff", name: "浮光掠影", price: "", itemValue: "", preferredExterior: "略有磨损", marketHashName: "★ Butterfly Knife | Gamma Doppler (Minimal Wear)", tier: "green", winRate: 0.1, weaponSrc: "/assets/classic-box/weapons/weapon-15.png", weaponName: "蝴蝶刀（★） | 伽玛多普勒" },
];
