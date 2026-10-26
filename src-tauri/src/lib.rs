use std::{path::PathBuf, sync::OnceLock};

use tauri::{
    http::{Response, StatusCode},
    Manager,
};
use tokio::sync::Semaphore;

// Pastas de imagem da YGOPRODeck aceitas pelo protocolo ygoimg://
const IMAGE_DIRS: [&str; 3] = ["cards", "cards_small", "cards_cropped"];

fn http() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent("Cartas/0.1")
            .build()
            .expect("cliente HTTP")
    })
}

/// Limita downloads simultâneos para respeitar o limite de requisições da YGOPRODeck
fn downloads() -> &'static Semaphore {
    static SEM: OnceLock<Semaphore> = OnceLock::new();
    SEM.get_or_init(|| Semaphore::new(6))
}

/// Aceita só "<pasta>/<id numérico>.jpg"; qualquer outra coisa é rejeitada
fn parse_image_path(path: &str) -> Option<(&str, &str)> {
    let (dir, file) = path.trim_start_matches('/').split_once('/')?;
    let id = file.strip_suffix(".jpg")?;
    let valid = IMAGE_DIRS.contains(&dir) && !id.is_empty() && id.bytes().all(|b| b.is_ascii_digit());
    valid.then_some((dir, file))
}

/// Lê a imagem do cache em disco; se não existir, baixa uma única vez e salva
async fn load_image(cache_root: PathBuf, dir: &str, file: &str) -> Result<Vec<u8>, String> {
    let local = cache_root.join("images").join(dir).join(file);
    if let Ok(bytes) = tokio::fs::read(&local).await {
        return Ok(bytes);
    }

    let _permit = downloads().acquire().await.map_err(|e| e.to_string())?;
    // outra requisição pode ter baixado enquanto esta esperava na fila
    if let Ok(bytes) = tokio::fs::read(&local).await {
        return Ok(bytes);
    }

    let url = format!("https://images.ygoprodeck.com/images/{dir}/{file}");
    let bytes = http()
        .get(&url)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?
        .to_vec();

    if let Some(parent) = local.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    // grava num temporário e renomeia, para nunca deixar imagem pela metade no cache
    let tmp = local.with_extension("part");
    tokio::fs::write(&tmp, &bytes).await.map_err(|e| e.to_string())?;
    tokio::fs::rename(&tmp, &local).await.map_err(|e| e.to_string())?;

    Ok(bytes)
}

/// Resposta da TCG API repassada ao app: o corpo JSON e quantas consultas restam hoje.
#[derive(serde::Serialize)]
struct TcgApiResponse {
    status: u16,
    body: String,
    remaining: Option<String>,
}

/// Busca preços na TCG API (tcgapi.dev). Feita aqui no Rust porque a API só aceita chamadas
/// do próprio site (CORS); a chave é a do usuário, guardada só no computador dele.
#[tauri::command]
async fn tcgapi_search(api_key: String, query: String) -> Result<TcgApiResponse, String> {
    let res = http()
        .get("https://api.tcgapi.dev/v1/search")
        .query(&[("q", query.as_str()), ("game", "yugioh"), ("per_page", "50")])
        .header("X-API-Key", api_key)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let remaining = res
        .headers()
        .get("x-ratelimit-remaining")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(TcgApiResponse { status, body, remaining })
}

/// Resposta de um provedor de IA repassada ao app (status HTTP e corpo JSON).
#[derive(serde::Serialize)]
struct IaResponse {
    status: u16,
    body: String,
}

/// Chamada a uma API de IA no formato da OpenAI (/chat/completions) com a chave do usuário.
/// Feita aqui no Rust porque vários provedores não aceitam chamadas da janela do app (CORS).
/// Só aceita endpoints /chat/completions em https, ou http no próprio computador (Ollama, LM Studio).
#[tauri::command]
async fn ia_chat(url: String, api_key: String, body: String) -> Result<IaResponse, String> {
    let local = url.starts_with("http://localhost") || url.starts_with("http://127.0.0.1");
    if !(url.starts_with("https://") || local) || !url.ends_with("/chat/completions") {
        return Err("endereço de IA não permitido".into());
    }
    let mut req = http()
        .post(&url)
        .header("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(600))
        .body(body);
    if !api_key.is_empty() {
        req = req.bearer_auth(api_key);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(IaResponse { status, body })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // abre links no navegador padrão (a janela do app não abre janelas novas)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![tcgapi_search, ia_chat])
        .register_asynchronous_uri_scheme_protocol("ygoimg", |ctx, request, responder| {
            let cache_root = ctx.app_handle().path().app_cache_dir();
            let path = request.uri().path().to_string();

            tauri::async_runtime::spawn(async move {
                let response = match (cache_root, parse_image_path(&path)) {
                    (Ok(root), Some((dir, file))) => match load_image(root, dir, file).await {
                        Ok(bytes) => Response::builder()
                            .header("Content-Type", "image/jpeg")
                            .header("Cache-Control", "max-age=31536000, immutable")
                            .header("Access-Control-Allow-Origin", "*")
                            .body(bytes),
                        Err(err) => {
                            eprintln!("falha ao obter imagem {path}: {err}");
                            Response::builder().status(StatusCode::BAD_GATEWAY).body(Vec::new())
                        }
                    },
                    _ => Response::builder().status(StatusCode::BAD_REQUEST).body(Vec::new()),
                };
                responder.respond(response.expect("resposta HTTP válida"));
            });
        })
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o app");
}
