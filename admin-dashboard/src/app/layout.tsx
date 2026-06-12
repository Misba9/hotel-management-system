import "./globals.css";
import { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import { AdminFcmBootstrap } from "@/components/notifications/admin-fcm-bootstrap";
import { AdminAppCheckBootstrap } from "@/components/providers/admin-app-check-bootstrap";
import { QueryProvider } from "@/components/providers/query-provider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <QueryProvider>
          <AuthProvider>
            <AdminAppCheckBootstrap />
            <FirebaseAnalytics />
            <AdminFcmBootstrap />
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
