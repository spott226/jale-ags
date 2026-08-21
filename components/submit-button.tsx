"use client";
import { useFormStatus } from "react-dom";
export function SubmitButton({children,className="btn btn-primary w-full",pending="Guardando…"}:{children:React.ReactNode;className?:string;pending?:string}) {
  const {pending:isPending}=useFormStatus();
  return <button type="submit" disabled={isPending} className={className}>{isPending?pending:children}</button>;
}
