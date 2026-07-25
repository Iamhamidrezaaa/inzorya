import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/w/:path*",
    "/onboarding/:path*",
    "/dashboard",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
