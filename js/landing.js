// landing.js — Auth only on home page
// Requires: auth.js (createAccount, signIn, redirectIfAuthed)

import { createAccount, signIn, redirectIfAuthed } from "./auth.js";

const tabSignin = document.getElementById("tab-signin");
const tabCreate = document.getElementById("tab-create");
const formSignin = document.getElementById("form-signin");
const formCreate = document.getElementById("form-create");
const msg = document.getElementById("auth-msg");

// si déjà connecté → dashboard
redirectIfAuthed?.();

function showForm(kind) {
    if (kind === "signin") {
        formSignin.style.display = "";
        formCreate.style.display = "none";
    } else {
        formSignin.style.display = "none";
        formCreate.style.display = "";
    }
    msg.textContent = "";
}

tabSignin.addEventListener("click", () => showForm("signin"));
tabCreate.addEventListener("click", () => showForm("create"));

// Sign in
formSignin.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("si-email").value.trim();
    try {
        signIn(email);
        window.location.href = "event-planner/index.html";
    } catch (err) {
        msg.textContent = err.message || "Sign in failed.";
    }
});

// Create account
formCreate.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("cr-name").value.trim();
    const email = document.getElementById("cr-email").value.trim();
    try {
        createAccount(name, email);
        window.location.href = "event-planner/index.html";
    } catch (err) {
        msg.textContent = err.message || "Account creation failed.";
    }
});