"use client";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { rememberAgreed, safeNext } from "../form";
import { PhoneCode } from "../PhoneCode";
import s from "../auth.module.css";

// Log in and sign-up share one path. A known number logs in, and a new number creates the Buddy account.
// The 18+ and Terms box must be ticked before the code is sent. After the code, everyone lands on Home.
export default function Login() {
  const next = useSearchParams().get("next");

  async function verify(phone: string, code: string, dial: string) {
    await api("vendor/auth/phone-login/verify", {
      method: "POST", body: { countryCode: dial, phone, code, acceptTerms: true, signupFlow: 3 },
    });
    rememberAgreed();
    // Use a full page load. The logo's link prefetched "/" while signed out, and the router would replay that redirect to /login.
    window.location.replace(safeNext(next));
  }

  return (
    <>
      <title>Log in or sign up · Any-Buddy Pro</title>
      <div className={s.head}>
        <h1>Log in or sign up</h1>
        <p className="sub">We'll text you a code to log in. No password needed.</p>
      </div>
      {/* Log in is by mobile number only, by design. There is no email log-in, because email is for receipts, notices and messages. */}
      <PhoneCode submit="Continue" verify={verify} consent
        send={(phone, dial) => api("vendor/auth/phone-login/send-code", { method: "POST", body: { countryCode: dial, phone } })} />
    </>
  );
}
