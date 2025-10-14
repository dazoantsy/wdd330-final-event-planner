// /js/api.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://cekijhhbnxgapiqlowfx.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNla2lqaGhibnhnYXBpcWxvd2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODcwMzQsImV4cCI6MjA3NTU2MzAzNH0.Pefh7gC-oSAgPVUiO1t2WvH70cdPT81YvqaHcbCgDKc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export async function getUserOrNull() {
    try { const { data } = await supabase.auth.getUser(); return data?.user || null; }
    catch { return null; }
}
export const isInPlanner = () => location.pathname.includes("/event-planner/");
export const rootIndexURL = () => (isInPlanner() ? "../index.html" : "./index.html");
