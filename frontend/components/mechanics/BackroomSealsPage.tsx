"use client";

import { useState } from "react";
import { ArrowLeftRight, Plus, Stamp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSealHoldings, useSealMovements } from "@/hooks/useMechanics";
import { Section, StatTile } from "./BackroomShell";
import { IssueSealsDialog, SealActionDialog, type SealActionMode } from "./SealDialogs";
import { SealHoldingsTable, SealMovementLog } from "./SealAndNoteTables";

type Dialog = { mode: SealActionMode | "issue"; delegateId?: number } | null;

export function BackroomSealsPage() {
  const [dialog, setDialog] = useState<Dialog>(null);
  const { data: holdings } = useSealHoldings();
  const { data: movements } = useSealMovements();

  const held = holdings?.reduce((s, d) => s + d.seal_count, 0);
  const spent = movements?.filter((m) => m.action === "SPENT").reduce((s, m) => s + m.quantity, 0);
  const close = (open: boolean) => !open && setDialog(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Seals held" value={held ?? "—"} hint="Across all delegates" />
        <StatTile label="Seals spent" value={spent ?? "—"} hint="Sent to the crisis room" />
        <StatTile
          label="Delegates without seals"
          value={holdings ? holdings.filter((d) => d.seal_count === 0).length : "—"}
        />
      </div>

      <Section
        title="Wax seals"
        description="Seals each delegate currently holds."
        actions={
          <>
            <Button variant="outline" onClick={() => setDialog({ mode: "transfer" })}>
              <ArrowLeftRight /> Transfer
            </Button>
            <Button variant="outline" onClick={() => setDialog({ mode: "spend" })}>
              <Stamp /> Spend
            </Button>
            <Button onClick={() => setDialog({ mode: "issue" })}>
              <Plus /> Issue Seals
            </Button>
          </>
        }
      >
        <SealHoldingsTable
          holdings={holdings}
          onAction={(mode, delegateId) => setDialog({ mode, delegateId })}
        />
      </Section>

      <Section
        title="Seal log"
        description="Every seal issued, transferred, spent or revoked, newest first."
      >
        <SealMovementLog movements={movements} />
      </Section>

      <IssueSealsDialog
        open={dialog?.mode === "issue"}
        onOpenChange={close}
        delegates={holdings}
        defaultDelegateId={dialog?.delegateId}
      />
      <SealActionDialog
        mode={dialog && dialog.mode !== "issue" ? dialog.mode : "transfer"}
        open={!!dialog && dialog.mode !== "issue"}
        onOpenChange={close}
        delegates={holdings}
        defaultDelegateId={dialog?.delegateId}
      />
    </div>
  );
}
