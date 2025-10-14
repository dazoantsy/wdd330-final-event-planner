// /js/validate.js
export function clearError(el) {
    el.classList.remove("invalid");
    const m = el.parentElement?.querySelector?.(".field-error");
    if (m) m.remove();
}
export function showError(el, msg) {
    clearError(el);
    el.classList.add("invalid");
    el.insertAdjacentHTML("afterend", `<div class="field-error">${msg}</div>`);
}
export function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
}
export function requireNonEmpty(el, msg = "Required") {
    if (!el.value || !el.value.trim()) { showError(el, msg); return false; }
    clearError(el); return true;
}
export function requireEmail(el, msg = "Invalid email") {
    if (!isEmail(el.value)) { showError(el, msg); return false; }
    clearError(el); return true;
}
export function requireDate(el, msg = "Invalid date/time") {
    const d = el.value ? new Date(el.value) : null;
    if (!d || isNaN(d.getTime())) { showError(el, msg); return false; }
    clearError(el); return true;
}
export function requireEndAfter(startEl, endEl, msg = "End must be after start") {
    const s = new Date(startEl.value); const e = new Date(endEl.value);
    if (endEl.value && (!e || isNaN(e) || e <= s)) { showError(endEl, msg); return false; }
    clearError(endEl); return true;
}
