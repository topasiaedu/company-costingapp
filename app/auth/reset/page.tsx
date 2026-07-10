"use client";

import { useRouter } from "next/navigation";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export default function AuthResetPage() {
  const router = useRouter();

  return (
    <ResetPasswordForm
      onSuccess={() => {
        router.push("/");
      }}
    />
  );
}
