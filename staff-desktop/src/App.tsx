import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { CloudConnectionProvider } from "@/contexts/CloudConnectionContext";
import { OfflineSyncProvider } from "@/contexts/OfflineSyncContext";
import { StaffDbProvider, ThemeProvider } from "@/contexts/ThemeContext";
import { RoleGuard } from "@/components/RoleGuard";
import { homePathForRole } from "@/lib/role-routes";
import { CashierDashboard } from "@/pages/CashierDashboard";
import { KitchenDashboard } from "@/pages/KitchenDashboard";
import { LoginPage } from "@/pages/LoginPage";
import { ManagerDesktopModule } from "@/features/manager/manager-desktop-module";
import { OrdersPage } from "@/pages/OrdersPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SettingsPage } from "@/pages/SettingsPage";

function RootRedirect() {
  const { profile, authReady, loading } = useAuth();
  if (!authReady || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950">
        Loading session…
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={homePathForRole(profile.role)} replace />;
}

function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  return (
    <CloudConnectionProvider>
      <CartProvider>
        <OfflineSyncProvider>{children}</OfflineSyncProvider>
      </CartProvider>
    </CloudConnectionProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/cashier"
        element={
          <RoleGuard path="/cashier">
            <AuthenticatedShell>
              <CashierDashboard />
            </AuthenticatedShell>
          </RoleGuard>
        }
      />
      <Route
        path="/kitchen"
        element={
          <RoleGuard path="/kitchen">
            <AuthenticatedShell>
              <KitchenDashboard />
            </AuthenticatedShell>
          </RoleGuard>
        }
      />
      <Route
        path="/orders"
        element={
          <RoleGuard path="/orders">
            <AuthenticatedShell>
              <OrdersPage />
            </AuthenticatedShell>
          </RoleGuard>
        }
      />
      <Route
        path="/manager/*"
        element={
          <RoleGuard path="/manager">
            <AuthenticatedShell>
              <ManagerDesktopModule />
            </AuthenticatedShell>
          </RoleGuard>
        }
      />
      <Route
        path="/profile"
        element={
          <RoleGuard path="/profile">
            <AuthenticatedShell>
              <ProfilePage />
            </AuthenticatedShell>
          </RoleGuard>
        }
      />
      <Route
        path="/settings"
        element={
          <RoleGuard path="/settings">
            <AuthenticatedShell>
              <SettingsPage />
            </AuthenticatedShell>
          </RoleGuard>
        }
      />
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StaffDbProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </StaffDbProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
