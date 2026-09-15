import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "66SKINS · 本地纪念版",
  description: "66SKINS 旧版首页的本地 UI 复原",
  icons: { icon: "/assets/default-avatar.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
