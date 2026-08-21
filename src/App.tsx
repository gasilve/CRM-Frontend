import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "./components/auth/RequireAuth";
import RequireStaff from "./components/auth/RequireStaff";
import FullScreenLoader from "./components/auth/FullScreenLoader";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AcceptInvite from "./pages/auth/AcceptInvite";
import MfaSetup from "./pages/auth/MfaSetup";
import MfaVerify from "./pages/auth/MfaVerify";
import AwaitingAccess from "./pages/auth/AwaitingAccess";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

const AppShell = lazy(() => import("./components/layout/AppShell"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Cases = lazy(() => import("./pages/Cases"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const PendingCaseDetail = lazy(() => import("./pages/PendingCaseDetail"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Investigators = lazy(() => import("./pages/Investigators"));
const InvestigatorNew = lazy(() => import("./pages/InvestigatorNew"));
const InvestigatorDetail = lazy(() => import("./pages/InvestigatorDetail"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Assistant = lazy(() => import("./pages/Assistant"));
const DocumentGenerator = lazy(() => import("./pages/DocumentGenerator"));
const VideoPlayer = lazy(() => import("./pages/VideoPlayer"));

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullScreenLoader message="Loading" />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      {/* Public auth routes — outside AppShell, no session required */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/mfa-verify" element={<MfaVerify />} />
      <Route path="/awaiting-access" element={<AwaitingAccess />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* Signed-in, but not yet MFA-enrolled — still outside AppShell */}
      <Route path="/mfa-setup" element={<MfaSetup />} />

      <Route element={<RequireAuth />}>
        <Route
          element={
            <LazyRoute>
              <AppShell />
            </LazyRoute>
          }
        >
          <Route
            index
            element={
              <LazyRoute>
                <Dashboard />
              </LazyRoute>
            }
          />
          <Route element={<RequireStaff />}>
            <Route
              path="/cases"
              element={
                <LazyRoute>
                  <Cases />
                </LazyRoute>
              }
            />
            <Route
              path="/cases/:id"
              element={
                <LazyRoute>
                  <CaseDetail />
                </LazyRoute>
              }
            />
            <Route path="/pending-cases" element={<Navigate to="/cases" replace />} />
            <Route
              path="/pending-cases/:id"
              element={
                <LazyRoute>
                  <PendingCaseDetail />
                </LazyRoute>
              }
            />
            <Route
              path="/schedule"
              element={
                <LazyRoute>
                  <Schedule />
                </LazyRoute>
              }
            />
            <Route
              path="/investigators"
              element={
                <LazyRoute>
                  <Investigators />
                </LazyRoute>
              }
            />
            <Route
              path="/investigators/new"
              element={
                <LazyRoute>
                  <InvestigatorNew />
                </LazyRoute>
              }
            />
            <Route
              path="/investigators/:id"
              element={
                <LazyRoute>
                  <InvestigatorDetail />
                </LazyRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <LazyRoute>
                  <Calendar />
                </LazyRoute>
              }
            />
            <Route
              path="/video"
              element={
                <LazyRoute>
                  <VideoPlayer />
                </LazyRoute>
              }
            />
          </Route>
          <Route
            path="/profile"
            element={
              <LazyRoute>
                <Profile />
              </LazyRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <LazyRoute>
                <Settings />
              </LazyRoute>
            }
          />
          <Route
            path="/assistant"
            element={
              <LazyRoute>
                <Assistant />
              </LazyRoute>
            }
          />
          <Route
            path="/documents"
            element={
              <LazyRoute>
                <DocumentGenerator />
              </LazyRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
