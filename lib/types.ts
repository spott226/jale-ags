export type Role = "worker" | "employer" | "admin";
export type Profile = { id: string; full_name: string; phone: string; role: Role; status: "active" | "suspended" | "blocked"; municipality: string | null };
export type Job = {
  id: string; employer_id: string; title: string; category: string; description: string;
  workers_needed: number; municipality: string; zone: string; job_date: string;
  start_time: string; duration_hours: number; pay_amount: number; payment_method: string;
  notes: string | null; status: string; paid: boolean; candidate_limit: number;
  candidate_count?: number; confirmed_count?: number; created_at: string;
};
export type Application = {
  id: string; job_id: string; worker_id: string; status: string; applied_at: string;
  selected_at?: string; confirmed_at?: string; job?: Job;
};
