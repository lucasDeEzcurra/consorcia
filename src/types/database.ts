export type UserRole = "admin" | "supervisor";

export interface UserProfile {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Supervisor {
  id: string;
  user_id: string;
  name: string;
  phone_number: string;
  created_at: string;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  supervisor_id: string | null;
  emails: string[];
  created_at: string;
}

export interface Job {
  id: string;
  building_id: string;
  description_original: string;
  description_generated: string | null;
  status: "pending" | "completed";
  created_at: string;
  completed_at: string | null;
  expense_amount: number | null;
  expense_provider: string | null;
  expense_category: string | null;
}

export interface Media {
  id: string;
  job_id: string;
  type: "before" | "after";
  url: string;
  created_at: string;
}

export interface Report {
  id: string;
  building_id: string;
  month: string;
  status: "draft" | "sent";
  generated_text: string | null;
  created_at: string;
  sent_at: string | null;
}
