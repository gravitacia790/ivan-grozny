import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const ponomar = localFont({ src: "../public/fonts/Ponomar-Regular.ttf", variable: "--font-display", display: "swap", weight: "400" });
export const metadata: Metadata = {
  title: "Исповедь Ивана Грозного — разговор с историей",
  description: "Учебный разговор о реформах, власти и решениях Ивана IV. История и информатика, 7 класс.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg` }
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" className={ponomar.variable}><body>{children}</body></html>;
}
