// no console window behind the app on windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mixture_screenkit_desktop_lib::run()
}
