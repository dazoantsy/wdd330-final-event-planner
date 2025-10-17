// /js/auth-page.js — logique des boutons Sign in / Sign up sur index.html & auth.html
import { supabase, rootIndexURL } from "./api.js?v=20251017";

const emailEl = document.querySelector("#auth-email");
const passEl = document.querySelector("#auth-password");
const btnIn = document.querySelector("#btn-signin");
const btnUp = document.querySelector("#btn-signup");
const btnReset = document.querySelector("#btn-reset");
const statusEl = document.querySelector("#auth-status");

function setStatus(msg, kind = "info") {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = "status " + (kind || "info");
}

async function signIn() {
    const email = emailEl?.value?.trim();
    const password = passEl?.value || "";
    if (!email || !password) { setStatus("Email and password required", "error"); return; }
    setStatus("Signing in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setStatus(error.message, "error"); return; }
    location.href = "./event-planner/index.html";
}

async function signUp() {
    const email = emailEl?.value?.trim();
    const password = passEl?.value || "";
    if (!email || !password) { setStatus("Email and password required", "error"); return; }
    setStatus("Creating account...");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) { setStatus(error.message, "error"); return; }
    setStatus("Account created. Check your email, then sign in.", "success");
}

async function resetPw() {
    const email = emailEl?.value?.trim();
    if (!email) { setStatus("Enter your email", "error"); return; }
    setStatus("Sending reset link...");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/auth.html" });
    if (error) { setStatus(error.message, "error"); return; }
    setStatus("Reset email sent.", "success");
}

btnIn?.addEventListener("click", signIn);
btnUp?.addEventListener("click", signUp);
btnReset?.addEventListener("click", resetPw);
