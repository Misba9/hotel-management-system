import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { DEFAULT_SETTINGS, type StaffDesktopSettings } from "./main-types";

const SETTINGS_FILE = "staff-desktop-settings.json";

function settingsPath(): string {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

export function loadSettings(): StaffDesktopSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<StaffDesktopSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(partial: Partial<StaffDesktopSettings>): StaffDesktopSettings {
  const next = { ...loadSettings(), ...partial };
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}
