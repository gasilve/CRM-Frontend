import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "./components/auth/RequireAuth";
import RequirePermission from "./components/auth/RequirePermission";
import RequirePatternLab from "./components/auth/RequirePatternLab";
import FullScreenLoader from "./components/auth/FullScreenLoader";
import { PanelLoader } from "./components/ui/LoadingState";
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
const MyDay = lazy(() => import("./pages/MyDay"));
const Cases = lazy(() => import("./pages/Cases"));
const NewCase = lazy(() => import("./pages/NewCase"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const SkyView = lazy(() => import("./components/cases/SkyViewModal"));
const CaseWorkMode = lazy(() => import("./pages/CaseWorkMode"));
const PendingCases = lazy(() => import("./pages/PendingCases"));
const PendingCaseDetail = lazy(() => import("./pages/PendingCaseDetail"));
const Playground = lazy(() => import("./pages/Playground"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Investigators = lazy(() => import("./pages/Investigators"));
const InvestigatorNew = lazy(() => import("./pages/InvestigatorNew"));
const InvestigatorDetail = lazy(() => import("./pages/InvestigatorDetail"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Profile = lazy(() => import("./pages/Profile"));
const Administration = lazy(() => import("./pages/Administration"));
const Assistant = lazy(() => import("./pages/Assistant"));
const DocumentGenerator = lazy(() => import("./pages/DocumentGenerator"));
const Reports = lazy(() => import("./pages/Reports"));
const VideoPlayer = lazy(() => import("./pages/VideoPlayer"));

function LazyRoute({ children }: { children: ReactNode }) {
  // Panel loader only — the full boot screen was remounting on every route
  // chunk fetch and felt like the whole app was reloading.
  return <Suspense fallback={<PanelLoader message="Loading" />}>{children}</Suspense>;
}

function ShellRoute({ children }: { children: ReactNode }) {
  // First shell mount can keep the boot screen; later navigations stay in-app.
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
            <ShellRoute>
              <AppShell />
            </ShellRoute>
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
          <Route element={<RequirePermission anyOf={["cases.view"]} />}>
            <Route
              path="/my-day"
              element={
                <LazyRoute>
                  <MyDay />
                </LazyRoute>
              }
            />
            <Route
              path="/cases"
              element={
                <LazyRoute>
                  <Cases />
                </LazyRoute>
              }
            />
            <Route element={<RequirePermission anyOf={["cases.create"]} />}>
              <Route
                path="/cases/new"
                element={
                  <LazyRoute>
                    <NewCase />
                  </LazyRoute>
                }
              />
            </Route>
            <Route
              path="/cases/:id/skyview"
              element={
                <LazyRoute>
                  <SkyView />
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
          </Route>
          <Route element={<RequirePermission anyOf={["cases.work", "cases.edit"]} />}>
            <Route
              path="/cases/:id/work"
              element={
                <LazyRoute>
                  <CaseWorkMode />
                </LazyRoute>
              }
            />
          </Route>
          <Route element={<RequirePermission anyOf={["intake.view"]} />}>
            <Route
              path="/pending-cases"
              element={
                <LazyRoute>
                  <PendingCases />
                </LazyRoute>
              }
            />
            <Route
              path="/pending-cases/:id"
              element={
                <LazyRoute>
                  <PendingCaseDetail />
                </LazyRoute>
              }
            />
          </Route>
          <Route
            path="/playground"
            element={
              <LazyRoute>
                <RequirePatternLab>
                  <Playground />
                </RequirePatternLab>
              </LazyRoute>
            }
          />
          <Route path="/pattern-lab" element={<Navigate to="/playground" replace />} />
          <Route element={<RequirePermission anyOf={["schedule.view"]} />}>
            <Route
              path="/schedule"
              element={
                <LazyRoute>
                  <Schedule />
                </LazyRoute>
              }
            />
          </Route>
          <Route element={<RequirePermission anyOf={["team.view"]} />}>
            <Route
              path="/investigators"
              element={
                <LazyRoute>
                  <Investigators />
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
          </Route>
          <Route element={<RequirePermission anyOf={["team.invite"]} />}>
            <Route
              path="/investigators/new"
              element={
                <LazyRoute>
                  <InvestigatorNew />
                </LazyRoute>
              }
            />
          </Route>
          <Route element={<RequirePermission anyOf={["clients.view"]} />}>
            <Route
              path="/clients"
              element={
                <LazyRoute>
                  <Clients />
                </LazyRoute>
              }
            />
            <Route
              path="/clients/:id"
              element={
                <LazyRoute>
                  <ClientDetail />
                </LazyRoute>
              }
            />
          </Route>
          <Route element={<RequirePermission anyOf={["video.use"]} />}>
            <Route
              path="/video"
              element={
                <LazyRoute>
                  <VideoPlayer />
                </LazyRoute>
              }
            />
          </Route>
          <Route element={<RequirePermission anyOf={["admin.roles", "admin.users"]} />}>
            <Route
              path="/administration"
              element={
                <LazyRoute>
                  <Administration />
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
          {/* Settings split into a personal Profile page and the Administration page. */}
          <Route path="/settings" element={<Navigate to="/profile" replace />} />
          <Route element={<RequirePermission anyOf={["assistant.use"]} />}>
            <Route
              path="/assistant"
              element={
                <LazyRoute>
                  <Assistant />
                </LazyRoute>
              }
            />
          </Route>
          <Route
            path="/reports"
            element={
              <LazyRoute>
                <Reports />
              </LazyRoute>
            }
          />
          <Route element={<RequirePermission anyOf={["documents.generate"]} />}>
            <Route
              path="/documents"
              element={
                <LazyRoute>
                  <DocumentGenerator />
                </LazyRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
