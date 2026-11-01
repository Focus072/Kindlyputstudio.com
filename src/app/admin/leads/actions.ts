"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function setLeadStatus(fd: FormData) {
  await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id) || !["new", "contacted", "won", "closed"].includes(status)) return;
  await supabaseAdmin().from("leads").update({ status }).eq("id", id);
  revalidatePath("/admin/leads");
}
