"use client";

import { PhoneLogin } from "@/components/auth/PhoneLogin";
import { Store } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PartnerLoginPage() {
  const router = useRouter();

  const handleSuccess = async () => {
    router.push("/partner");
    router.refresh();
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <div className="p-6 flex flex-col items-center pt-20">
        <div className="size-16 rounded-2xl bg-zinc-100 text-zinc-600 flex items-center justify-center mb-8">
          <Store className="size-8" />
        </div>

        <div className="w-full max-w-[320px]">
          <PhoneLogin
            title="Partner login"
            subtitle="Sign in to manage your store"
            onSuccess={handleSuccess}
          />
        </div>
      </div>

      <div className="mt-auto p-8 text-center">
        <p className="text-xs text-zinc-400">
          Wyshkit for partners
        </p>
      </div>
    </div>
  );
}
