import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/types";

export const companyService = {
  async list() {
    const sb = createClient();
    const { data, error } = await sb.from("companies").select("*").order("ticker");
    if (error) throw error;
    return data as Company[];
  },
  async create(c: Partial<Company>) {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb.from("companies").insert({ ...c, user_id: user!.id }).select().single();
    if (error) throw error;
    return data as Company;
  },
  async update(id: string, c: Partial<Company>) {
    const sb = createClient();
    const { data, error } = await sb.from("companies").update(c).eq("id", id).select().single();
    if (error) throw error;
    return data as Company;
  },
  async remove(id: string) {
    const sb = createClient();
    const { error } = await sb.from("companies").delete().eq("id", id);
    if (error) throw error;
  },
};
