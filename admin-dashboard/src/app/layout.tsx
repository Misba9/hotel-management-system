import "./globals.css";
import { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import { AdminFcmBootstrap } from "@/components/notifications/admin-fcm-bootstrap";
import { AdminAppCheckBootstrap } from "@/components/providers/admin-app-check-bootstrap";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <AdminAppCheckBootstrap />
          <FirebaseAnalytics />
          <AdminFcmBootstrap />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
