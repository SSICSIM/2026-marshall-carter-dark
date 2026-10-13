"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreatePeriod } from "@/hooks/useCrisisPeriods";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePeriodDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const { mutate, isPending } = useCreatePeriod();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    mutate({ name: name.trim() }, { onSuccess: () => { setName(""); onOpenChange(false); } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Start a Crisis Update</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="period-name">Name</Label>
            <Input
              id="period-name"
              placeholder="e.g. Update 1, Round 3…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? "Starting…" : "Start Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
