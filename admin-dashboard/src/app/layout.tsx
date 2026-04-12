import "./globals.css";
import { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import { AdminFcmBootstrap } from "@/components/notifications/admin-fcm-bootstrap";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <FirebaseAnalytics />
          <AdminFcmBootstrap />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
