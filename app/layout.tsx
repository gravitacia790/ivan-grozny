import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Исповедь Ивана Грозного — разговор с историей",
  description: "Учебный разговор о реформах, власти и решениях Ивана IV. История и информатика, 7 класс.",
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/favicon.svg` }
};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
