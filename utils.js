export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(Number(value || 0));
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

export function debounce(fn, delay = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export const icons = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  car: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 17h14l1-5-2-5H6l-2 5 1 5Z"/><path d="M7 17v2M17 17v2M5 12h14"/><circle cx="8" cy="14.5" r=".8" fill="currentColor"/><circle cx="16" cy="14.5" r=".8" fill="currentColor"/></svg>`,
  fuel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 21V4h9v17M4 21h11M7 8h5"/><path d="M14 7h2l3 3v8a2 2 0 0 0 2 2V9l-2-2"/></svg>`,
  wrench: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 9.6 6 7.3 3.7a4 4 0 0 0 5 5L4 17l3 3 8.3-8.3a4 4 0 0 0 5-5L18 9l-2.4-2.4L18 4.3a4 4 0 0 0-3.3 2Z"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m3 6 5-3 8 3 5-3v15l-5 3-8-3-5 3V6Z"/><path d="M8 3v15M16 6v15"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 5v14M5 12h14"/></svg>`,
  sync: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 7h-5V2M4 17h5v5"/><path d="M18.4 9A7 7 0 0 0 6 5.6L4 7M5.6 15A7 7 0 0 0 18 18.4L20 17"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  odometer: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19a9 9 0 1 1 16 0"/><path d="m12 13 4-4"/><path d="M8 19h8"/></svg>`,
  road: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M8 3 5 21M16 3l3 18M12 3v4M12 11v4M12 19v2"/></svg>`,
  gauge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19a8 8 0 1 1 16 0"/><path d="m12 14 3-5"/><path d="M8 19h8"/></svg>`,
  dollar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>`,
  location: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 20h9"/><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z"/></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 6h18M5 6v14h14V6M8 3h8l2 3H6l2-3Z"/><path d="M9 11h6"/></svg>`,
  restore: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`
};

export function mountIcons(root = document) {
  $$("[data-icon]", root).forEach(element => {
    const name = element.dataset.icon;
    if (icons[name]) element.innerHTML = icons[name];
  });
}
