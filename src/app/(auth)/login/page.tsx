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
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const { dictionary: d } = useI18n();
  const [pending, setPending] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    setPending(false);

    if (result?.error) {
      toast.error(d.auth.invalidCredentials);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  });

  return (
    <Card className="border-border/80 shadow-md">
      <CardHeader className="space-y-2 pb-2">
        <CardTitle className="text-xl tracking-tight">
          {d.auth.welcomeBack}
        </CardTitle>
        <CardDescription>{d.auth.signInDesc}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <form className="space-y-5" onSubmit={onSubmit}>
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
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">{d.auth.password}</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {d.auth.forgotPassword}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              className="text-start"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <Button className="w-full" size="lg" type="submit" disabled={pending}>
            {pending ? d.auth.signingIn : d.auth.signIn}
          </Button>
        </form>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          {d.auth.noAccount}{" "}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {d.auth.createOne}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
