// Role comes exclusively from get_application_role, which derives auth.uid in SQL.
export function isAdmin(role) { return role === "admin"; }

export function safeDestination(value, base = "http://localhost/") {
  try {
    const origin = new URL(base).origin;
    const url = new URL(value || "./app.html", base);
    if (url.origin !== origin || !url.pathname.endsWith("/app.html")) return "./app.html";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "./app.html"; }
}

export function authHref(page, destination = "./app.html") {
  return `./${page}.html?next=${encodeURIComponent(destination)}`;
}
