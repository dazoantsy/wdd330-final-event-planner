import { load, save } from "./storage.js";

const USERS_KEY = "ep-users";   // [{id,name,email}]
const SESSION_KEY = "ep-user";  // {id,name,email}

function uid() { return crypto.randomUUID(); }

export function currentUser() {
    return load(SESSION_KEY, null);
}

export function redirectIfAuthed() {
    const u = currentUser();
    if (u) window.location.href = "event-planner/index.html";
}

export function requireAuth() {
    const u = currentUser();
    if (!u) window.location.href = "../index.html";
    return u;
}

export function signOut() {
    localStorage.removeItem(SESSION_KEY);
}

export function createAccount(name, email) {
    email = email.trim().toLowerCase();
    const users = load(USERS_KEY, []);
    if (users.some(u => u.email === email)) {
        throw new Error("This email is already registered.");
    }
    const user = { id: uid(), name: name.trim(), email };
    users.push(user);
    save(USERS_KEY, users);
    save(SESSION_KEY, user);
    return user;
}

export function signIn(email) {
    email = email.trim().toLowerCase();
    const users = load(USERS_KEY, []);
    const user = users.find(u => u.email === email);
    if (!user) throw new Error("No account found for this email.");
    save(SESSION_KEY, user);
    return user;
}
