import "./globals.css";
import { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { FirebaseAnalytics } from "@/components/firebase-analytics";
import { AdminFcmBootstrap } from "@/components/notifications/admin-fcm-bootstrap";
import { AdminAppCheckBootstrap } from "@/components/providers/admin-app-check-bootstrap";
import { QueryProvider } from "@/components/providers/query-provider";
import { AdminThemeProvider } from "@/components/providers/theme-provider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k="nausheen_theme_preference";var p=localStorage.getItem(k);var r=p==="light"||p==="dark"?p:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var d=document.documentElement;d.classList.toggle("dark",r==="dark");d.style.colorScheme=r;d.dataset.theme=r;}catch(e){}})();`
          }}
        />
      </head>
      <body className="min-h-screen bg-theme-background text-theme-text-primary antialiased">
        <AdminThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <AdminAppCheckBootstrap />
              <FirebaseAnalytics />
              <AdminFcmBootstrap />
              {children}
            </AuthProvider>
          </QueryProvider>
        </AdminThemeProvider>
      </body>
    </html>
  );
}
