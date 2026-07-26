"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  workspaceName: z.string().min(2).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { dictionary: d } = useI18n();
  const [pending, setPending] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      workspaceName: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = (await response.json()) as {
      error?: string;
      workspaceSlug?: string;
    };

    if (!response.ok) {
      setPending(false);
      toast.error(data.error ?? "Registration failed.");
      return;
    }

    const signInResult = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setPending(false);

    if (signInResult?.error) {
      toast.error(d.auth.alreadyHave);
      router.push("/login");
      return;
    }

    router.push(
      `/onboarding/business?workspace=${data.workspaceSlug ?? ""}`,
    );
    router.refresh();
  });

  return (
    <Card className="border-border/80 shadow-md">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-xl tracking-tight">
          {d.auth.createAccount}
        </CardTitle>
        <CardDescription>{d.auth.registerDesc}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">{d.auth.fullName}</Label>
            <Input id="name" autoComplete="name" {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{d.auth.email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              dir="ltr"
              className="text-start"
              {...form.register("email")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{d.auth.password}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              className="text-start"
              {...form.register("password")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspaceName">{d.auth.workspaceName}</Label>
            <Input
              id="workspaceName"
              placeholder={d.auth.optional}
              {...form.register("workspaceName")}
            />
          </div>
          <Button className="mt-1 w-full" size="lg" type="submit" disabled={pending}>
            {pending ? d.common.loading : d.auth.createAccount}
          </Button>
        </form>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {d.auth.alreadyHave}{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {d.common.login}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
