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

const PAGE: &str = "<!doctype html><html lang=\"da\"><head><meta charset=\"utf-8\"><title>Bing Ads Chat</title>\
<style>body{font-family:'Segoe UI',system-ui,sans-serif;background:#f6f7fb;color:#111827;display:grid;place-items:center;height:100vh;margin:0}\
div{background:#fff;padding:40px 48px;border-radius:24px;box-shadow:0 10px 40px -12px rgb(16 24 40/.18);text-align:center}\
h1{font-size:20px;margin:0 0 8px}p{color:#6b7280;margin:0}</style></head>\
<body><div><h1>Du er logget ind</h1><p>Du kan lukke dette vindue og vende tilbage til Bing Ads Chat.</p></div></body></html>";

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
