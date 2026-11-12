import { supabase } from "@/integrations/supabase/client";

export type AdminSubstitute = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  approved: boolean;
  background_status: "pending" | "approved" | "needs_renewal";
  school_name: string | null;
  graduation_year: number | null;
  subjects: string[];
  availability: string | null;
  has_cv: boolean;
  is_test: boolean;
};

export async function getAdminSubstitutes(
  limit: number,
  offset: number,
): Promise<AdminSubstitute[]> {
  // Local contract for the additive RPC until Supabase type generation is run.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: "admin_substitutes_page",
    args: { p_limit: number; p_offset: number },
  ) => PromiseLike<{ data: AdminSubstitute[] | null; error: { message: string } | null }>;
  const { data, error } = await rpc("admin_substitutes_page", { p_limit: limit, p_offset: offset });
  if (error) throw new Error(error.message);
  return data ?? [];
}
