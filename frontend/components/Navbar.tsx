"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LineChart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterManagerDialog } from "@/components/crisis/CharacterManagerDialog";

export function Navbar() {
  const [charOpen, setCharOpen] = useState(false);
  const pathname = usePathname();

  // The frontroom is a full-screen board for the projector.
  if (pathname.startsWith("/frontroom")) return null;

  return (
    <>
      <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <Link href="/backroom/net-worth" className="text-sm font-semibold tracking-tight">
            Crisis Tracker
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/frontroom">
                <LineChart className="mr-2 h-4 w-4" />
                Mechanics
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCharOpen(true)}>
              <Users className="mr-2 h-4 w-4" />
              Characters
            </Button>
          </div>
        </div>
      </header>
      <CharacterManagerDialog open={charOpen} onOpenChange={setCharOpen} />
    </>
  );
}
