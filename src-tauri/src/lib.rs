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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
