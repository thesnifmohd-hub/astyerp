import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErpProvider, useErp } from './ErpContext';
import { AppShell } from './layouts/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { SitesPage } from '@/features/sites/SitesPage';
import { DailyReportingPage } from '@/features/dpr/DailyReportingPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { MaterialsPage } from '@/features/materials/MaterialsPage';
import { BoqPage } from '@/features/boq/BoqPage';
import { PlanningPage } from '@/features/planning/PlanningPage';
import { LabourSubconPage } from '@/features/labour/LabourSubconPage';
import { AccountingPage } from '@/features/accounting/AccountingPage';
import { BillingPage } from '@/features/billing/BillingPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { ClientPortalPage } from '@/features/portal/ClientPortalPage';
import { AdminPage } from '@/features/admin/AdminPage';

const queryClient = new QueryClient();

function AuthenticatedRoutes() {
  const { currentUser } = useErp();
  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/sites" element={<SitesPage />} />
        <Route path="/dpr" element={<DailyReportingPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/materials" element={<MaterialsPage />} />
        <Route path="/boq" element={<BoqPage />} />
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/labour" element={<LabourSubconPage />} />
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/portal" element={<ClientPortalPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErpProvider>
        <BrowserRouter>
          <AuthenticatedRoutes />
        </BrowserRouter>
      </ErpProvider>
    </QueryClientProvider>
  );
}

