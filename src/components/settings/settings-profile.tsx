"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsProfile({
  initialName,
  initialEmail,
}: {
  initialName: string;
  initialEmail: string;
}) {
  const { update } = useSession();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pendingProfile, setPendingProfile] = useState(false);
  const [pendingPassword, setPendingPassword] = useState(false);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setPendingProfile(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "profile", name, email }),
    });
    setPendingProfile(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Could not update profile.");
      return;
    }
    await update({ name, email });
    toast.success("Profile saved.");
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPendingPassword(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "password",
        currentPassword,
        newPassword,
      }),
    });
    setPendingPassword(false);
    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Could not update password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    toast.success("Password updated.");
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={saveProfile}
        className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-5"
      >
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={pendingProfile}>
          {pendingProfile ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <form
        onSubmit={savePassword}
        className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-5"
      >
        <h2 className="text-sm font-semibold">Password</h2>
        <div className="space-y-2">
          <Label htmlFor="currentPassword">Current password</Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPassword">New password</Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <Button type="submit" disabled={pendingPassword}>
          {pendingPassword ? "Updating…" : "Update password"}
        </Button>
      </form>

      <div className="max-w-xl space-y-4 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Theme</h2>
        <p className="text-sm text-muted-foreground">
          Dark mode is the default. Switch anytime.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={theme === "dark" ? "default" : "outline"}
            onClick={() => setTheme("dark")}
          >
            Dark
          </Button>
          <Button
            type="button"
            variant={theme === "light" ? "default" : "outline"}
            onClick={() => setTheme("light")}
          >
            Light
          </Button>
        </div>
      </div>
    </div>
  );
}
