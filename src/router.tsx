import { createBrowserRouter, Navigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { RoleGuard } from "@/components/RoleGuard";
import { AppLayout } from "@/components/AppLayout";
import { AdminLayout } from "@/components/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { BuildingPage } from "@/pages/BuildingPage";
import { ReportPage } from "@/pages/ReportPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { SupervisorsPage } from "@/pages/admin/SupervisorsPage";
import { SupervisorDetailPage } from "@/pages/admin/SupervisorDetailPage";
import { AdminBuildingsPage } from "@/pages/admin/AdminBuildingsPage";
import { AdminBuildingDetailPage } from "@/pages/admin/AdminBuildingDetailPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <AuthGuard />,
    children: [
      // Admin routes
      {
        element: <RoleGuard allowed="admin" />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              { path: "/admin/dashboard", element: <AdminDashboardPage /> },
              { path: "/admin/supervisors", element: <SupervisorsPage /> },
              { path: "/admin/supervisors/:id", element: <SupervisorDetailPage /> },
              { path: "/admin/buildings", element: <AdminBuildingsPage /> },
              { path: "/admin/buildings/:id", element: <AdminBuildingDetailPage /> },
            ],
          },
        ],
      },
      // Supervisor routes
      {
        element: <RoleGuard allowed="supervisor" />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: "/dashboard", element: <DashboardPage /> },
              { path: "/buildings/:id", element: <BuildingPage /> },
              { path: "/buildings/:id/report", element: <ReportPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/login" replace />,
  },
]);
