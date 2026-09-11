import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppLayout } from "./components/AppLayout";
import { RequireAuth } from "./auth/RequireAuth";
import { DashboardPage } from "./pages/DashboardPage";
import { TimerPage } from "./pages/TimerPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { CalendarPage } from "./pages/CalendarPage";
import { StudyPage } from "./pages/StudyPage";
import { HabitsPage } from "./pages/HabitsPage";
import { MomentsPage } from "./pages/MomentsPage";
import { StatsPage } from "./pages/StatsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { TrialExpiredPage } from "./pages/TrialExpiredPage";

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: true,
        staleTime: 30_000,
      },
    },
  });
}

interface AppProps {
  queryClient?: QueryClient;
}

export function App({ queryClient }: AppProps) {
  const [client] = useState(() => queryClient ?? createAppQueryClient());

  return (
    <QueryClientProvider client={client}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/trial-expired" element={<TrialExpiredPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/timer" element={<TimerPage />} />
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/moments" element={<MomentsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
