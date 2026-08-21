"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { signInAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

const REMEMBERED_EMAIL_KEY = "jale:remembered-email";

export function RememberedLoginForm({ next = "" }: { next?: string }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (saved && emailRef.current) emailRef.current.value = saved;
  }, []);

  function rememberEmail(event: FormEvent<HTMLFormElement>) {
    const email = String(new FormData(event.currentTarget).get("email")??"").trim();
    if (remember && email) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }

  return <form action={signInAction} onSubmit={rememberEmail} className="grid gap-4 mt-6">
    <input type="hidden" name="next" value={next}/>
    <label className="label">Correo<input ref={emailRef} className="field" name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required/></label>
    <label className="label">Contraseña<input className="field" name="password" type="password" autoComplete="current-password" placeholder="••••••••" minLength={8} required/></label>
    <label className="remember-login"><input type="checkbox" checked={remember} onChange={(event)=>setRemember(event.target.checked)}/><span><b>Recordarme en este dispositivo</b><small>Tu sesión seguirá abierta y guardaremos únicamente tu correo.</small></span></label>
    <SubmitButton>ENTRAR A MI PANEL</SubmitButton>
  </form>;
}
