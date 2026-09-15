use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

const BASE_API_URL: &str = "https://api.democracycraft.net/economy";
const GITHUB_REPO: &str = "JFT10/DCFinanceClient";
const APP_VERSION: &str = "0.1.0";

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateResponse {
    pub update_available: bool,
    pub current_version: String,
    pub latest_commit_sha: Option<String>,
    pub full_commit_sha: Option<String>,
    pub latest_commit_message: Option<String>,
    pub commit_date: Option<String>,
    pub html_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GitHubCommitInfo {
    sha: String,
    html_url: Option<String>,
    commit: GitHubCommitDetails,
}

#[derive(Debug, Deserialize)]
struct GitHubCommitDetails {
    message: String,
    author: Option<GitHubAuthor>,
}

#[derive(Debug, Deserialize)]
struct GitHubAuthor {
    date: String,
}

/// Check GitHub repository `main` branch for updates on startup.
#[tauri::command]
async fn check_for_updates() -> Result<UpdateResponse, String> {
    let client = reqwest::Client::builder()
        .user_agent("DCFinanceClient-Desktop")
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("https://api.github.com/repos/{}/commits/main", GITHUB_REPO);
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to reach GitHub API: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("GitHub API status: {}", resp.status()));
    }

    let commit_info: GitHubCommitInfo = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

    let short_sha = if commit_info.sha.len() >= 7 {
        commit_info.sha[0..7].to_string()
    } else {
        commit_info.sha.clone()
    };

    Ok(UpdateResponse {
        update_available: true,
        current_version: APP_VERSION.to_string(),
        latest_commit_sha: Some(short_sha),
        full_commit_sha: Some(commit_info.sha),
        latest_commit_message: Some(commit_info.commit.message),
        commit_date: commit_info.commit.author.map(|a| a.date),
        html_url: commit_info.html_url.or_else(|| Some(format!("https://github.com/{}", GITHUB_REPO))),
    })
}

/// Helper to find the key.env file path
fn find_env_file() -> std::path::PathBuf {
    if Path::new("key.env").exists() {
        Path::new("key.env").to_path_buf()
    } else if Path::new("../key.env").exists() {
        Path::new("../key.env").to_path_buf()
    } else {
        Path::new("key.env").to_path_buf()
    }
}

/// Load Treasury API key from key.env or environment variable
#[tauri::command]
fn load_api_key() -> Result<Option<String>, String> {
    if let Ok(key) = std::env::var("TREASURY_API_KEY") {
        if !key.trim().is_empty() {
            return Ok(Some(key.trim().to_string()));
        }
    }

    let env_path = find_env_file();
    if env_path.exists() {
        let content = fs::read_to_string(&env_path).map_err(|e| e.to_string())?;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("TREASURY_API_KEY=") {
                let key_val = trimmed.trim_start_matches("TREASURY_API_KEY=").trim();
                let clean_key = key_val.trim_matches('"').trim_matches('\'');
                if !clean_key.is_empty() {
                    return Ok(Some(clean_key.to_string()));
                }
            }
        }
    }

    Ok(None)
}

/// Save Treasury API key to key.env
#[tauri::command]
fn save_api_key(key: String) -> Result<(), String> {
    let env_path = find_env_file();
    let content = format!(
        "# DemocracyCraft Treasury API Key\n# Updated by DC Finance Client\nTREASURY_API_KEY=\"{}\"\n",
        key.trim()
    );
    fs::write(&env_path, content).map_err(|e| format!("Failed to write key.env: {}", e))?;
    Ok(())
}

/// Forward authenticated API requests to DemocracyCraft Treasury API
#[tauri::command]
async fn treasury_request(
    endpoint: String,
    method: String,
    body: Option<String>,
) -> Result<serde_json::Value, String> {
    let api_key = load_api_key()?
        .ok_or_else(|| "Treasury API key is not configured in key.env".to_string())?;

    let clean_endpoint = if endpoint.starts_with('/') {
        endpoint
    } else {
        format!("/{}", endpoint)
    };

    let url = format!("{}{}", BASE_API_URL, clean_endpoint);
    let client = reqwest::Client::new();

    let mut req_builder = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => client.get(&url),
    };

    req_builder = req_builder
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "application/json");

    if let Some(b) = body {
        req_builder = req_builder
            .header("Content-Type", "application/json")
            .body(b);
    }

    let resp = req_builder
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let status = resp.status();
    let retry_after = resp
        .headers()
        .get("Retry-After")
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(60);

    let text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    if status.as_u16() == 429 {
        return Err(format!("RATE_LIMIT:{}", retry_after));
    }

    let json_val: serde_json::Value = serde_json::from_str(&text).unwrap_or_else(|_| {
        serde_json::json!({
            "message": text
        })
    });

    if !status.is_success() {
        let msg = json_val
            .get("message")
            .and_then(|m| m.as_str())
            .or_else(|| json_val.get("error").and_then(|e| e.as_str()))
            .unwrap_or("API request failed");
        return Err(format!("{}: {}", status, msg));
    }

    Ok(json_val)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            check_for_updates,
            load_api_key,
            save_api_key,
            treasury_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
