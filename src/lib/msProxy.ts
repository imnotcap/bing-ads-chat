/**
 * The Microsoft hosts a browser may reach through `/__proxy` (Microsoft Advertising sends no
 * CORS headers). Used by the Vite dev server and by the Cloudflare Worker that serves the web
 * app; mirrors the HTTP scope of the desktop app in src-tauri/capabilities/default.json.
 */
export const PROXY_ALLOW = [
  /^https:\/\/[a-z0-9.-]+\.api\.bingads\.microsoft\.com\//,
  /^https:\/\/[a-z0-9.-]+\.api\.sandbox\.bingads\.microsoft\.com\//,
  /^https:\/\/content\.api\.ads\.microsoft\.com\//,
  /^https:\/\/login\.microsoftonline\.com\//,
  /^https:\/\/[a-z0-9.-]+\.blob\.core\.windows\.net\//,
];

/** Request headers passed on to Microsoft (nothing else – no cookies, no Origin). */
export const FORWARD_HEADERS = ['authorization', 'authenticationtoken', 'developertoken', 'customerid', 'customeraccountid', 'content-type', 'accept'];
