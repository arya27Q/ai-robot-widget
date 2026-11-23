use std::fs;
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Mutex,
};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{
    menu::{CheckMenuItemBuilder, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, Position, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

#[cfg(desktop)]
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

static BUDDY_COUNTER: AtomicU32 = AtomicU32::new(1);
static MSG_COUNTER: AtomicU32 = AtomicU32::new(1);

#[derive(Default)]
struct CpuTracker {
    prev_idle: u64,
    prev_kernel: u64,
    prev_user: u64,
    initialized: bool,
}

#[derive(Serialize)]
struct SystemStats {
    cpu_percent: u8,
    ram_percent: u8,
    ram_used_gb: f32,
    ram_total_gb: f32,
    battery_percent: Option<u8>,
    is_charging: Option<bool>,
}

#[derive(Serialize)]
struct WindowCenter {
    x: f64,
    y: f64,
}

#[derive(Serialize, Deserialize, Clone)]
struct SwarmPeerInfo {
    id: String,
    theme: String,
    x: f64,
    y: f64,
    ts: u64,
}

#[derive(Serialize)]
struct SwarmSyncResponse {
    peers: Vec<SwarmPeerInfo>,
    messages: Vec<String>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn swarm_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("ai_robot_reminder_swarm_v1");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn sanitize_id(raw: &str) -> String {
    raw.chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .take(48)
        .collect()
}

/// Cross-process + cross-window swarm heartbeat & message sync via %TEMP%
/// Works 100% reliably across separate .exe processes AND +Buddy windows with zero firewall prompts.
#[tauri::command]
fn swarm_sync(peer_id: String, theme: String, x: f64, y: f64) -> SwarmSyncResponse {
    let dir = swarm_dir();
    let now = now_ms();
    let safe_id = sanitize_id(&peer_id);

    // 1. Write own heartbeat atomically-ish
    let self_info = SwarmPeerInfo {
        id: safe_id.clone(),
        theme,
        x,
        y,
        ts: now,
    };
    if let Ok(json) = serde_json::to_string(&self_info) {
        let self_path = dir.join(format!("peer_{safe_id}.json"));
        let _ = fs::write(self_path, json);
    }

    // 2. Read active peers & recent messages, prune expired files
    let mut peers = Vec::new();
    let mut messages = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(fname) = path.file_name().and_then(|s| s.to_str()) else {
                continue;
            };

            if fname.starts_with("peer_") && fname.ends_with(".json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(peer) = serde_json::from_str::<SwarmPeerInfo>(&content) {
                        if now.saturating_sub(peer.ts) > 3500 {
                            let _ = fs::remove_file(&path);
                        } else if peer.id != safe_id {
                            peers.push(peer);
                        }
                    }
                }
            } else if fname.starts_with("msg_") && fname.ends_with(".json") {
                // Filename format: msg_<timestamp_ms>_<seq>.json
                let parts: Vec<&str> = fname.split('_').collect();
                let msg_ts = parts
                    .get(1)
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(0);
                if now.saturating_sub(msg_ts) > 6000 {
                    let _ = fs::remove_file(&path);
                } else if let Ok(content) = fs::read_to_string(&path) {
                    messages.push(content);
                }
            }
        }
    }

    SwarmSyncResponse { peers, messages }
}

/// Broadcast a swarm interaction message to ALL windows & separate .exe processes.
#[tauri::command]
fn swarm_post(app: AppHandle, payload: String) {
    let dir = swarm_dir();
    let now = now_ms();
    let seq = MSG_COUNTER.fetch_add(1, Ordering::Relaxed);
    let msg_path = dir.join(format!("msg_{now}_{seq}.json"));
    let _ = fs::write(msg_path, &payload);

    // Instant 0ms delivery for same-process +Buddy windows
    let _ = app.emit("swarm-msg", payload);
}

#[tauri::command]
fn swarm_bye(peer_id: String) {
    let dir = swarm_dir();
    let safe_id = sanitize_id(&peer_id);
    let _ = fs::remove_file(dir.join(format!("peer_{safe_id}.json")));
}

#[cfg(windows)]
mod win_sys {
    #[repr(C)]
    pub struct FileTime {
        pub low: u32,
        pub high: u32,
    }

    #[repr(C)]
    pub struct MemoryStatusEx {
        pub dw_length: u32,
        pub dw_memory_load: u32,
        pub ull_total_phys: u64,
        pub ull_avail_phys: u64,
        pub ull_total_page_file: u64,
        pub ull_avail_page_file: u64,
        pub ull_total_virtual: u64,
        pub ull_avail_virtual: u64,
        pub ull_avail_extended_virtual: u64,
    }

    #[repr(C)]
    pub struct SystemPowerStatus {
        pub ac_line_status: u8,
        pub battery_flag: u8,
        pub battery_life_percent: u8,
        pub system_status_flag: u8,
        pub battery_life_time: u32,
        pub battery_full_life_time: u32,
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn GetSystemTimes(
            lp_idle_time: *mut FileTime,
            lp_kernel_time: *mut FileTime,
            lp_user_time: *mut FileTime,
        ) -> i32;
        pub fn GlobalMemoryStatusEx(lp_buffer: *mut MemoryStatusEx) -> i32;
        pub fn GetSystemPowerStatus(lp_system_power_status: *mut SystemPowerStatus) -> i32;
    }

    pub fn ft_to_u64(ft: &FileTime) -> u64 {
        ((ft.high as u64) << 32) | (ft.low as u64)
    }
}

#[tauri::command]
fn get_system_stats(tracker: State<'_, Mutex<CpuTracker>>) -> SystemStats {
    #[cfg(windows)]
    {
        use win_sys::*;

        let mut idle = FileTime { low: 0, high: 0 };
        let mut kernel = FileTime { low: 0, high: 0 };
        let mut user = FileTime { low: 0, high: 0 };
        let mut cpu_percent: u8 = 0;

        let ok_cpu = unsafe { GetSystemTimes(&mut idle, &mut kernel, &mut user) };
        if ok_cpu != 0 {
            let idle_v = ft_to_u64(&idle);
            let kernel_v = ft_to_u64(&kernel);
            let user_v = ft_to_u64(&user);

            if let Ok(mut state) = tracker.lock() {
                if state.initialized {
                    let d_idle = idle_v.saturating_sub(state.prev_idle);
                    let d_kernel = kernel_v.saturating_sub(state.prev_kernel);
                    let d_user = user_v.saturating_sub(state.prev_user);
                    let total = d_kernel.saturating_add(d_user);
                    if total > 0 {
                        let busy = total.saturating_sub(d_idle);
                        cpu_percent = ((busy as f64 / total as f64) * 100.0)
                            .round()
                            .clamp(0.0, 100.0) as u8;
                    }
                }
                state.prev_idle = idle_v;
                state.prev_kernel = kernel_v;
                state.prev_user = user_v;
                state.initialized = true;
            }
        }

        let mut mem = MemoryStatusEx {
            dw_length: std::mem::size_of::<MemoryStatusEx>() as u32,
            dw_memory_load: 0,
            ull_total_phys: 0,
            ull_avail_phys: 0,
            ull_total_page_file: 0,
            ull_avail_page_file: 0,
            ull_total_virtual: 0,
            ull_avail_virtual: 0,
            ull_avail_extended_virtual: 0,
        };
        let mut ram_percent: u8 = 0;
        let mut ram_used_gb: f32 = 0.0;
        let mut ram_total_gb: f32 = 0.0;

        let ok_mem = unsafe { GlobalMemoryStatusEx(&mut mem) };
        if ok_mem != 0 {
            ram_percent = mem.dw_memory_load.min(100) as u8;
            let gb = 1024.0 * 1024.0 * 1024.0;
            ram_total_gb = (mem.ull_total_phys as f64 / gb) as f32;
            let used_bytes = mem.ull_total_phys.saturating_sub(mem.ull_avail_phys);
            ram_used_gb = (used_bytes as f64 / gb) as f32;
        }

        let mut power = SystemPowerStatus {
            ac_line_status: 255,
            battery_flag: 255,
            battery_life_percent: 255,
            system_status_flag: 0,
            battery_life_time: 0,
            battery_full_life_time: 0,
        };
        let mut battery_percent: Option<u8> = None;
        let mut is_charging: Option<bool> = None;

        let ok_pwr = unsafe { GetSystemPowerStatus(&mut power) };
        if ok_pwr != 0 && power.battery_life_percent <= 100 {
            battery_percent = Some(power.battery_life_percent);
            is_charging = Some(power.ac_line_status == 1);
        }

        return SystemStats {
            cpu_percent,
            ram_percent,
            ram_used_gb: (ram_used_gb * 10.0).round() / 10.0,
            ram_total_gb: (ram_total_gb * 10.0).round() / 10.0,
            battery_percent,
            is_charging,
        };
    }

    #[cfg(not(windows))]
    {
        let _ = tracker;
        SystemStats {
            cpu_percent: 0,
            ram_percent: 0,
            ram_used_gb: 0.0,
            ram_total_gb: 0.0,
            battery_percent: None,
            is_charging: None,
        }
    }
}

#[tauri::command]
fn get_window_center(window: WebviewWindow) -> WindowCenter {
    let scale = window.scale_factor().unwrap_or(1.0);
    let pos = window
        .outer_position()
        .unwrap_or(PhysicalPosition::new(0, 0));
    let size = window.outer_size().unwrap_or_default();
    WindowCenter {
        x: (pos.x as f64 + size.width as f64 / 2.0) / scale,
        y: (pos.y as f64 + size.height as f64 / 2.0) / scale,
    }
}

fn spawn_buddy_internal(app: &AppHandle) -> Result<(), String> {
    let num = BUDDY_COUNTER.fetch_add(1, Ordering::Relaxed);
    let label = format!("buddy-{num}");
    let themes = ["sakura", "emerald", "violet", "gold", "cyan"];
    let theme = themes[(num as usize - 1) % themes.len()];

    // Use WebviewUrl::default() (index.html without query string) + initialization_script
    // so production bundles ALWAYS resolve index.html cleanly on Windows WebView2!
    let init_script = format!(
        "window.__ROBOT_BUDDY__ = {{ num: {num}, theme: \"{theme}\" }};"
    );

    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
        .title(format!("AI Robot Buddy #{num}"))
        .inner_size(360.0, 460.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .shadow(false)
        .skip_taskbar(true)
        .initialization_script(&init_script);

    if let Some(main_win) = app.get_webview_window("main") {
        let scale = main_win.scale_factor().unwrap_or(1.0);
        if let Ok(pos) = main_win.outer_position() {
            let offset_x = if num % 2 == 1 { 215.0 } else { -215.0 };
            let logical_x = (pos.x as f64 / scale) + offset_x;
            let logical_y = pos.y as f64 / scale;
            builder = builder.position(logical_x.max(0.0), logical_y.max(0.0));
        } else {
            builder = builder.center();
        }
    } else {
        builder = builder.center();
    }

    builder.build().map(|_| ()).map_err(|e| e.to_string())
}

/// MUST be async on Windows so WebviewWindowBuilder::build() never deadlocks WebView2 UI thread!
#[tauri::command]
async fn spawn_buddy_window(app: AppHandle) -> Result<(), String> {
    spawn_buddy_internal(&app)
}

fn close_all_buddies(app: &AppHandle) {
    for (label, win) in app.webview_windows() {
        if label.starts_with("buddy-") {
            let _ = win.close();
        }
    }
}

fn toggle_widget_visibility(app: &AppHandle) {
    let windows = app.webview_windows();
    let any_visible = windows
        .values()
        .any(|w| w.is_visible().unwrap_or(false));

    for win in windows.values() {
        if any_visible {
            let _ = win.hide();
        } else {
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

fn apply_dock_position_window(window: &WebviewWindow, mode: &str) {
    if mode == "top" {
        let monitor = window
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| window.primary_monitor().ok().flatten());

        if let Some(mon) = monitor {
            let mon_pos = mon.position();
            let mon_size = mon.size();
            if let Ok(win_size) = window.outer_size() {
                let x = mon_pos.x + (mon_size.width as i32 - win_size.width as i32) / 2;
                let y = mon_pos.y;
                let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
            }
        }
    } else {
        let _ = window.center();
    }
}

#[tauri::command]
fn set_dock_mode(window: WebviewWindow, mode: String) {
    let normalized = if mode == "top" { "top" } else { "center" };
    apply_dock_position_window(&window, normalized);
}

#[cfg(desktop)]
fn init_first_run_autostart(app: &AppHandle) -> bool {
    let autostart = app.autolaunch();

    #[cfg(not(debug_assertions))]
    {
        if let Ok(data_dir) = app.path().app_data_dir() {
            let marker = data_dir.join(".autostart_initialized");
            if !marker.exists() {
                let _ = fs::create_dir_all(&data_dir);
                let _ = autostart.enable();
                let _ = fs::write(&marker, "1");
            }
        }
    }

    autostart.is_enabled().unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(CpuTracker::default()))
        .invoke_handler(tauri::generate_handler![
            set_dock_mode,
            get_system_stats,
            get_window_center,
            spawn_buddy_window,
            swarm_sync,
            swarm_post,
            swarm_bye
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle()
                    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))?;
            }

            #[cfg(desktop)]
            let autostart_enabled = init_first_run_autostart(app.handle());
            #[cfg(not(desktop))]
            let autostart_enabled = false;

            let toggle_item =
                MenuItem::with_id(app, "toggle", "Show/Hide Widget", true, None::<&str>)?;
            let spawn_buddy_item = MenuItem::with_id(
                app,
                "spawn_buddy",
                "Tambah Teman Robot (+Buddy)",
                true,
                None::<&str>,
            )?;
            let close_buddies_item = MenuItem::with_id(
                app,
                "close_buddies",
                "Tutup Teman Robot",
                true,
                None::<&str>,
            )?;
            let sep0 = PredefinedMenuItem::separator(app)?;
            let dock_center_item = MenuItem::with_id(
                app,
                "dock_center",
                "Posisi: Ngambang di Tengah",
                true,
                None::<&str>,
            )?;
            let dock_top_item = MenuItem::with_id(
                app,
                "dock_top",
                "Posisi: Nempel di Layar Atas",
                true,
                None::<&str>,
            )?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let autostart_item =
                CheckMenuItemBuilder::with_id("autostart", "Auto-Start saat Windows Nyala")
                    .checked(autostart_enabled)
                    .build(app)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &toggle_item,
                    &spawn_buddy_item,
                    &close_buddies_item,
                    &sep0,
                    &dock_center_item,
                    &dock_top_item,
                    &sep1,
                    &autostart_item,
                    &sep2,
                    &quit_item,
                ],
            )?;

            let autostart_item_handle = autostart_item.clone();

            let mut tray_builder = TrayIconBuilder::with_id("ai-robot-tray")
                .tooltip("AI Robot Reminder")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "toggle" => toggle_widget_visibility(app),
                    "spawn_buddy" => {
                        let handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = spawn_buddy_internal(&handle);
                        });
                    }
                    "close_buddies" => close_all_buddies(app),
                    "dock_center" => {
                        if let Some(win) = app.get_webview_window("main") {
                            apply_dock_position_window(&win, "center");
                        }
                        let _ = app.emit("dock-mode-changed", "center");
                    }
                    "dock_top" => {
                        if let Some(win) = app.get_webview_window("main") {
                            apply_dock_position_window(&win, "top");
                        }
                        let _ = app.emit("dock-mode-changed", "top");
                    }
                    "autostart" => {
                        #[cfg(desktop)]
                        {
                            let manager = app.autolaunch();
                            let currently_enabled = manager.is_enabled().unwrap_or(false);
                            let result = if currently_enabled {
                                manager.disable()
                            } else {
                                manager.enable()
                            };
                            if result.is_ok() {
                                let new_state = manager.is_enabled().unwrap_or(!currently_enabled);
                                let _ = autostart_item_handle.set_checked(new_state);
                            }
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_widget_visibility(tray.app_handle());
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
