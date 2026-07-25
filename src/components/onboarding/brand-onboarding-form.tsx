"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const schema = z.object({
  name: z.string().min(2, "Brand name is required"),
  description: z.string().max(500).optional(),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export function BrandOnboardingForm({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "", website: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setPending(true);
    const response = await fetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceSlug,
        ...values,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      workspaceSlug?: string;
    };
    setPending(false);

    if (!response.ok) {
      toast.error(data.error ?? "Could not create brand.");
      return;
    }

    toast.success("Brand created.");
    router.push(`/w/${data.workspaceSlug ?? workspaceSlug}/home`);
    router.refresh();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand details</CardTitle>
        <CardDescription>
          Keep it simple. You can refine voice and channels later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Brand name</Label>
            <Input id="name" placeholder="Acme" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              placeholder="https://example.com"
              {...form.register("website")}
            />
            {form.formState.errors.website ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.website.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Short description</Label>
            <Textarea
              id="description"
              placeholder="What this brand stands for"
              {...form.register("description")}
            />
          </div>
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create brand and open Home"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
