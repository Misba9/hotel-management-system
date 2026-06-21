import { getFunctions, type Functions } from "firebase/functions";
import { getStaffDesktopFirebaseApp } from "@/lib/firebase";

let functionsInstance: Functions | null = null;

export async function getStaffDesktopFunctions(): Promise<Functions | null> {
  const app = await getStaffDesktopFirebaseApp();
  if (!app) return null;
  if (!functionsInstance) {
    functionsInstance = getFunctions(app, "us-central1");
  }
  return functionsInstance;
}
