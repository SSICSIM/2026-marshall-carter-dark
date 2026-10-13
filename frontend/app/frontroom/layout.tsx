import { Oswald, Playfair_Display } from "next/font/google";

import { cn } from "@/lib/utils";

// Gilded Age (1882) quotation room: engraved serif for the brass nameplate, condensed
// gothic signage type for the quotation board and ticker tape.
const plaque = Playfair_Display({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-plaque" });
const sign = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sign" });

export default function Layout(props: { children: React.ReactNode }) {
  // `dark` gives shadcn pieces (chart tooltip) dark surfaces; `ticker-board`
  // layers the vintage palette on top (see globals.css).
  return (
    <div className={cn("dark ticker-board font-sign min-h-screen", plaque.variable, sign.variable)}>
      {props.children}
    </div>
  );
}
