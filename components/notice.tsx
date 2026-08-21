export function Notice({ type="info", children }:{type?:"info"|"error"|"success";children:React.ReactNode}) {
  const colors={info:"bg-blue-50 border-blue-200 text-blue-900",error:"bg-red-50 border-red-200 text-red-900",success:"bg-green-50 border-green-200 text-green-900"};
  return <div role={type==="error"?"alert":"status"} className={`rounded-xl border p-3 text-sm font-bold ${colors[type]}`}>{children}</div>;
}
