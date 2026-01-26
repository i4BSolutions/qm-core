"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ArrowLeft, Mail, KeyRound, Shield, Radio } from "lucide-react";

type Step = "email" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [countdown, setCountdown] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === "otp") {
      otpRefs.current[0]?.focus();
    }
  }, [step]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false, // Only allow existing users
        },
      });

      if (error) {
        if (error.message.includes("Signups not allowed")) {
          setMessage({
            type: "error",
            text: "This email is not registered. Please contact your administrator.",
          });
        } else {
          setMessage({ type: "error", text: error.message });
        }
      } else {
        setStep("otp");
        setCountdown(60); // 60 second cooldown for resend
        setMessage({
          type: "success",
          text: "Verification code sent! Check your email.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const otpCode = otp.join("");

    if (otpCode.length !== 6) {
      setMessage({ type: "error", text: "Please enter the complete 6-digit code." });
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });

      if (error) {
        setMessage({ type: "error", text: "Invalid or expired code. Please try again." });
        // Clear OTP inputs on error
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      } else if (data.session) {
        setMessage({ type: "success", text: "Login successful! Redirecting..." });
        // Set session marker so AuthProvider knows this is a valid session
        sessionStorage.setItem("qm_session_active", "1");
        // Set initial activity timestamp
        localStorage.setItem("qm_last_activity", Date.now().toString());
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];

    // Handle paste
    if (value.length > 1) {
      const digits = value.slice(0, 6).split("");
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      // Focus last filled input or next empty
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;

    setIsLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setCountdown(60);
        setOtp(["", "", "", "", "", ""]);
        setMessage({ type: "success", text: "New verification code sent!" });
        otpRefs.current[0]?.focus();
      }
    } catch (error) {
      setMessage({ type: "error", text: "Failed to resend code." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setOtp(["", "", "", "", "", ""]);
    setMessage(null);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950">
      {/* Tactical grid overlay */}
      <div className="absolute inset-0 grid-overlay opacity-40" />

      {/* Scan line effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent animate-[scan-line_4s_linear_infinite]" />
      </div>

      {/* Gradient orbs - amber themed */}
      <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl animate-pulse" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-amber-500/5 blur-3xl" />

      {/* Corner decorations */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-amber-500/30" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-amber-500/30" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-amber-500/30" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-amber-500/30" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="tactical-card corner-accents p-8 animate-slide-up">
          {/* Scan overlay on card */}
          <div className="scan-overlay" />

          {/* Back button (only in OTP step) */}
          {step === "otp" && (
            <button
              onClick={handleBack}
              className="relative mb-4 flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-amber-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to email
            </button>
          )}

          {/* Logo / Brand */}
          <div className="relative mb-8 text-center">
            {/* Status indicator */}
            <div className="absolute -top-2 right-0 flex items-center gap-2 text-xs text-emerald-400">
              <span className="status-dot status-dot-done scale-75" />
              <span className="font-mono uppercase tracking-wider">System Online</span>
            </div>

            <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 shadow-lg shadow-amber-500/20 border border-amber-500/30">
              {step === "email" ? (
                <Shield className="h-10 w-10 text-white" />
              ) : (
                <KeyRound className="h-10 w-10 text-white" />
              )}
            </div>

            <div className="flex items-center justify-center gap-2 mb-2">
              <Radio className="h-4 w-4 text-amber-500" />
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {step === "email" ? "QM SYSTEM" : "VERIFY ACCESS"}
              </h1>
            </div>

            <p className="text-sm text-slate-400 font-mono">
              {step === "email"
                ? "// SECURE ACCESS PORTAL"
                : `// CODE SENT TO ${email}`}
            </p>
          </div>

          {/* Email Step */}
          {step === "email" && (
            <form onSubmit={handleSendOtp} className="relative space-y-6">
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="data-label flex items-center gap-2"
                >
                  <Mail className="h-3 w-3 text-amber-500" />
                  OPERATOR EMAIL
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@command.mil"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  className={cn(
                    "w-full rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3.5",
                    "text-slate-200 placeholder:text-slate-600 font-mono",
                    "transition-all duration-200",
                    "focus:border-amber-500/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                />
              </div>

              {/* Message display */}
              {message && (
                <div
                  className={cn(
                    "animate-fade-in rounded-lg px-4 py-3 text-sm font-mono border",
                    message.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                  )}
                >
                  {message.type === "success" ? "✓ " : "✗ "}{message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                className={cn(
                  "relative w-full overflow-hidden rounded-lg px-4 py-3.5",
                  "bg-gradient-to-r from-amber-600 to-amber-500",
                  "font-semibold text-white uppercase tracking-wider",
                  "transition-all duration-200",
                  "hover:from-amber-500 hover:to-amber-400 hover:shadow-lg hover:shadow-amber-500/20",
                  "focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-amber-600 disabled:hover:to-amber-500 disabled:hover:shadow-none"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    TRANSMITTING...
                  </span>
                ) : (
                  "REQUEST ACCESS CODE"
                )}
              </button>
            </form>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="relative space-y-6">
              {/* OTP Input */}
              <div className="space-y-3">
                <label className="data-label flex items-center gap-2">
                  <KeyRound className="h-3 w-3 text-amber-500" />
                  AUTHORIZATION CODE
                </label>
                <div className="flex justify-between gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      disabled={isLoading}
                      className={cn(
                        "h-14 w-12 rounded-lg border-2 border-slate-700 bg-slate-900/80 text-center text-xl font-bold font-mono",
                        "text-amber-400",
                        "transition-all duration-200",
                        "focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:bg-slate-800/80",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        digit && "border-amber-500/50 bg-slate-800/80"
                      )}
                    />
                  ))}
                </div>
              </div>

              {/* Message display */}
              {message && (
                <div
                  className={cn(
                    "animate-fade-in rounded-lg px-4 py-3 text-sm font-mono border",
                    message.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/10 text-red-400 border-red-500/30"
                  )}
                >
                  {message.type === "success" ? "✓ " : "✗ "}{message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || otp.join("").length !== 6}
                className={cn(
                  "relative w-full overflow-hidden rounded-lg px-4 py-3.5",
                  "bg-gradient-to-r from-amber-600 to-amber-500",
                  "font-semibold text-white uppercase tracking-wider",
                  "transition-all duration-200",
                  "hover:from-amber-500 hover:to-amber-400 hover:shadow-lg hover:shadow-amber-500/20",
                  "focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-slate-900",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-amber-600 disabled:hover:to-amber-500 disabled:hover:shadow-none"
                )}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    AUTHENTICATING...
                  </span>
                ) : (
                  "AUTHORIZE ACCESS"
                )}
              </button>

              {/* Resend button */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={countdown > 0 || isLoading}
                  className={cn(
                    "text-sm font-mono transition-colors",
                    countdown > 0
                      ? "text-slate-600 cursor-not-allowed"
                      : "text-amber-400 hover:text-amber-300"
                  )}
                >
                  {countdown > 0 ? `RETRANSMIT IN ${countdown}s` : "RETRANSMIT CODE"}
                </button>
              </div>
            </form>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-center text-xs text-slate-600 font-mono">
              CLASSIFIED // AUTHORIZED PERSONNEL ONLY
              <br />
              <span className="text-slate-700">Pre-registration required for system access</span>
            </p>
          </div>
        </div>

        {/* Version */}
        <div className="mt-6 text-center">
          <code className="text-xs text-slate-700 font-mono">QM-SYS v0.3.0 // BUILD 2026.01</code>
        </div>
      </div>
    </div>
  );
}
