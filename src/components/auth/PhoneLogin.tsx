"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { OTPInput } from "@/components/auth/OTPInput";
import { useAuth } from "@/hooks/useAuth";
import { ChevronLeft, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhoneLoginProps {
  onSuccess?: () => void;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
}

export function PhoneLogin({ onSuccess, onBack, title, subtitle }: PhoneLoginProps) {
  const { signInWithPhone, verifyOTP } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = async () => {
    if (!phone || phone.length !== 10) {
      setError("Enter a valid 10-digit number");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await signInWithPhone(phone);
      setLoading(false);
      
      if (result.success) {
        setStep("otp");
        setOtp("");
      } else {
        const isRetryable = result.isRetryable || result.error?.includes("500");
        if (isRetryable) {
          setError("Service issue. Proceed if you received OTP.");
          setStep("otp");
        } else {
          setError(result.error || "Failed to send OTP");
        }
      }
    } catch {
      setLoading(false);
      setError("Connection issue. Proceed if you received OTP.");
      setStep("otp");
    }
  };

  const handleVerifyOTP = async (otpValue: string) => {
    setError("");
    setLoading(true);

    try {
      const result = await verifyOTP(phone, otpValue);
      
      if (result.success) {
        setLoading(false);
        if (onSuccess) onSuccess();
      } else {
        setError(result.error || "Invalid OTP");
        setLoading(false);
      }
    } catch {
      setError("Verification failed");
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPhone(phone);
      setLoading(false);
      if (!result.success && !result.isRetryable) {
        setError(result.error || "Failed to resend");
      }
    } catch {
      setLoading(false);
      setError("Connection issue");
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 py-4">
      <div className="flex flex-col items-center text-center mb-10">
        <div className="size-16 rounded-[2rem] bg-zinc-50 flex items-center justify-center border border-zinc-100 mb-6 shadow-xl shadow-zinc-100/50">
           <ShieldCheck className="size-8 text-zinc-900" />
        </div>
        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">
          {step === "phone" ? (title || "Welcome back") : "Verify code"}
        </h2>
        <p className="text-sm text-zinc-500 mt-2 font-medium max-w-[240px]">
          {step === "phone" 
            ? (subtitle || "Enter your phone number to proceed with checkout") 
            : `We've sent a 6-digit code to +91 ${phone}`}
        </p>
      </div>

      {step === "phone" ? (
        <div className="space-y-6">
          <div className="group transition-all">
            <PhoneInput
              value={phone}
              onChange={setPhone}
              error={error}
              disabled={loading}
            />
          </div>
          <Button
            onClick={handleSendOTP}
            disabled={loading || phone.length !== 10}
            className={cn(
              "w-full h-15 rounded-[2rem] font-black text-base transition-all flex items-center justify-between px-8 group active:scale-[0.98]",
              phone.length === 10 ? "bg-zinc-900 text-white shadow-2xl shadow-zinc-950/20" : "bg-zinc-100 text-zinc-400"
            )}
          >
            <span>{loading ? "Sending..." : "Get OTP"}</span>
            {loading ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />}
          </Button>
          <div className="px-6">
            <p className="text-[10px] text-zinc-400 text-center leading-relaxed font-black uppercase tracking-[0.1em] opacity-60">
              Secure login powered by Wyshkit.<br/>By continuing, you agree to our terms.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <OTPInput
            value={otp}
            onChange={setOtp}
            onComplete={handleVerifyOTP}
            onResend={handleResendOTP}
            error={error}
            disabled={loading}
          />
          <div className="flex flex-col items-center gap-6">
            <button 
              onClick={() => setStep("phone")} 
              className="text-[10px] font-black text-zinc-400 flex items-center gap-2 hover:text-zinc-900 transition-colors uppercase tracking-[0.15em] bg-zinc-50 px-4 py-2 rounded-full active:scale-95"
            >
              <ChevronLeft className="size-3" />
              Change number
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Didn't get it?</span>
              <button 
                onClick={handleResendOTP} 
                className="text-zinc-900 text-xs font-black hover:underline active:scale-95 transition-transform" 
                disabled={loading}
              >
                RESEND OTP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
