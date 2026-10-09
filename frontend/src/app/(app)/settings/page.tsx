"use client";

import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-display text-xl font-bold text-foreground">Settings</h1>
      <p className="text-sm text-muted-foreground">
        General, summary template, playback and integrations — Phase 4.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          signOut();
          toast.info("Signed out");
          router.replace("/login");
        }}
      >
        <LogOutIcon className="size-3.5" />
        Sign out
      </Button>
    </div>
  );
}
