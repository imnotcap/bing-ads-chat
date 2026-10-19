//! Loopback redirect for the Microsoft sign-in (OAuth 2.0 authorization code + PKCE).
//!
//! `oauth_listen` binds a random port on 127.0.0.1 and returns it. The web layer
//! opens the Microsoft sign-in page with `redirect_uri=http://localhost:<port>`.
//! The first request carrying `code=` or `error=` is answered with a small page and
//! its query string is emitted to the window as the `oauth-callback` event. The
//! code exchange itself (with the PKCE verifier) happens in the web layer.

use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

const TIMEOUT: Duration = Duration::from_secs(300);

const PAGE: &str = "<!doctype html><html lang=\"da\"><head><meta charset=\"utf-8\"><title>XavierOS</title>\
<style>body{font-family:'Segoe UI',system-ui,sans-serif;background:#f6f7fb;color:#111827;display:grid;place-items:center;height:100vh;margin:0}\
div{background:#fff;padding:40px 48px;border-radius:24px;box-shadow:0 10px 40px -12px rgb(16 24 40/.18);text-align:center}\
h1{font-size:20px;margin:0 0 8px}p{color:#6b7280;margin:0}</style></head>\
<body><div><h1>Du er logget ind</h1><p>Du kan lukke dette vindue og vende tilbage til XavierOS.</p></div></body></html>";

/// Extracts the query string from a request line such as `GET /?code=abc HTTP/1.1`.
fn query_from_request_line(line: &str) -> Option<String> {
    let target = line.split_whitespace().nth(1)?;
    let (_, query) = target.split_once('?')?;
    Some(query.to_owned())
}

#[tauri::command]
pub fn oauth_listen(app: AppHandle) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;

    std::thread::spawn(move || {
        let started = Instant::now();
        while started.elapsed() < TIMEOUT {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_nonblocking(false);
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                    let mut line = String::new();
                    if BufReader::new(&stream).read_line(&mut line).is_err() {
                        continue;
                    }
                    let query = query_from_request_line(&line).unwrap_or_default();
                    let done = query.contains("code=") || query.contains("error=");
                    let body = if done { PAGE } else { "" };
                    let status = if done { "200 OK" } else { "404 Not Found" };
                    let _ = write!(
                        stream,
                        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                        body.len()
                    );
                    if done {
                        let _ = app.emit("oauth-callback", query);
                        return;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(100));
                }
                Err(_) => return,
            }
        }
        let _ = app.emit("oauth-callback", "error=timeout");
    });

    Ok(port)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_query() {
        assert_eq!(
            query_from_request_line("GET /?code=abc&state=xyz HTTP/1.1\r\n").as_deref(),
            Some("code=abc&state=xyz")
        );
        assert_eq!(query_from_request_line("GET /favicon.ico HTTP/1.1"), None);
    }
}

/// Percent-encodes a form value (`application/x-www-form-urlencoded`).
fn form_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => out.push(b as char),
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// Exchanges an authorization code or refresh token at the Microsoft token endpoint.
///
/// Done here instead of with the HTTP plugin: the plugin always adds the webview's
/// `Origin` header, and Microsoft then treats the request as a browser (SPA) token
/// redemption and rejects it for a desktop app registration (AADSTS90023).
/// Returns the HTTP status and the raw JSON body.
#[tauri::command]
pub async fn oauth_token(tenant: String, form: Vec<(String, String)>) -> Result<(u16, String), String> {
    let tenant: String = tenant.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '.').collect();
    let tenant = if tenant.is_empty() { "common".to_string() } else { tenant };
    let body = form
        .iter()
        .map(|(k, v)| format!("{}={}", form_encode(k), form_encode(v)))
        .collect::<Vec<_>>()
        .join("&");
    let res = tauri_plugin_http::reqwest::Client::new()
        .post(format!("https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"))
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("Microsoft kunne ikke kontaktes: {e}"))?;
    let status = res.status().as_u16();
    let text = res.text().await.map_err(|e| e.to_string())?;
    Ok((status, text))
}

#[cfg(test)]
mod form_tests {
    use super::form_encode;

    #[test]
    fn encodes_like_url_search_params() {
        assert_eq!(form_encode("https://ads.microsoft.com/msads.manage offline_access"), "https%3A%2F%2Fads.microsoft.com%2Fmsads.manage+offline_access");
        assert_eq!(form_encode("a-b_c.d~e"), "a-b_c.d~e");
    }
}
