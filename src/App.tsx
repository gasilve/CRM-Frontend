import { lazy, Suspense, type ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import RequireAuth from "./components/auth/RequireAuth";
import RequirePermission from "./components/auth/RequirePermission";
import RequirePatternLab from "./components/auth/RequirePatternLab";
import FullScreenLoader from "./components/auth/FullScreenLoader";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AcceptInvite from "./pages/auth/AcceptInvite";
import MfaSetup from "./pages/auth/MfaSetup";
import MfaVerify from "./pages/auth/MfaVerify";
import AwaitingAccess from "./pages/auth/AwaitingAccess";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// ── CRM pages ───────────────────────────────────────
const AppShell           = lazy(() => import("./components/layout/AppShell"));
const Dashboard          = lazy(() => import("./pages/Dashboard"));
const MyDay              = lazy(() => import("./pages/MyDay"));
const Cases              = lazy(() => import("./pages/Cases"));
const NewCase            = lazy(() => import("./pages/NewCase"));
const CaseDetail         = lazy(() => import("./pages/CaseDetail"));
const SkyView            = lazy(() => import("./components/cases/SkyViewModal"));
const CaseWorkMode       = lazy(() => import("./pages/CaseWorkMode"));
const PendingCases       = lazy(() => import("./pages/PendingCases"));
const PendingCaseDetail  = lazy(() => import("./pages/PendingCaseDetail"));
const Playground         = lazy(() => import("./pages/Playground"));
const Schedule           = lazy(() => import("./pages/Schedule"));
const Calendar           = lazy(() => import("./pages/Calendar"));
const Investigators      = lazy(() => import("./pages/Investigators"));
const InvestigatorNew    = lazy(() => import("./pages/InvestigatorNew"));
const InvestigatorDetail = lazy(() => import("./pages/InvestigatorDetail"));
const Clients            = lazy(() => import("./pages/Clients"));
const ClientDetail       = lazy(() => import("./pages/ClientDetail"));
const Profile            = lazy(() => import("./pages/Profile"));
const Administration     = lazy(() => import("./pages/Administration"));
const Assistant          = lazy(() => import("./pages/Assistant"));
const DocumentGenerator  = lazy(() => import("./pages/DocumentGenerator"));
const Reports            = lazy(() => import("./pages/Reports"));
const VideoPlayer        = lazy(() => import("./pages/VideoPlayer"));

// ── OSINT pages (Prodigy) ───────────────────────────
const OsintInvestigations     = lazy(() => import("./osint/pages/Investigations"));
const OsintInvestigationNew   = lazy(() => import("./osint/pages/InvestigationNew"));
const OsintInvestigationDetail = lazy(() => import("./osint/pages/InvestigationDetail"));
const OsintGlobe              = lazy(() => import("./osint/pages/Globe"));
const OsintReverseSearch      = lazy(() => import("./osint/pages/ReverseSearch"));
const OsintVideoCustody       = lazy(() => import("./osint/pages/VideoCustody"));
const OsintAudioTools         = lazy(() => import("./osint/pages/AudioTools").then(m => ({ default: m.AudioToolsPage })));
const OsintGodsEye            = lazy(() => import("./osint/pages/GodsEyeView").then(m => ({ default: m.GlobePage })));
const OsintVideoEvidence      = lazy(() => import("./osint/pages/VideoEvidence"));
const OsintMedicalCanvass     = lazy(() => import("./osint/pages/MedicalCanvass"));

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullScreenLoader message="Loading" />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/mfa-verify" element={<MfaVerify />} />
      <Route path="/awaiting-access" element={<AwaitingAccess />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/mfa-setup" element={<MfaSetup />} />

      <Route element={<RequireAuth />}>
        <Route element={<LazyRoute><AppShell /></LazyRoute>}>

          {/* Dashboard */}
          <Route index element={<LazyRoute><Dashboard /></LazyRoute>} />

          {/* ── CRM ── */}
          <Route element={<RequirePermission anyOf={["cases.view"]} />}>
            <Route path="/my-day" element={<LazyRoute><MyDay /></LazyRoute>} />
            <Route path="/cases" element={<LazyRoute><Cases /></LazyRoute>} />
            <Route path="/cases/:id/skyview" element={<LazyRoute><SkyView /></LazyRoute>} />
            <Route path="/cases/:id" element={<LazyRoute><CaseDetail /></LazyRoute>} />
          </Route>
          <Route element={<RequirePermission anyOf={["cases.create"]} />}>
            <Route path="/cases/new" element={<LazyRoute><NewCase /></LazyRoute>} />
          </Route>
          <Route element={<RequirePermission anyOf={["cases.work", "cases.edit"]} />}>
            <Route path="/cases/:id/work" element={<LazyRoute><CaseWorkMode /></LazyRoute>} />
          </Route>
          <Route element={<RequirePermission anyOf={["intake.view"]} />}>
            <Route path="/pending-cases" element={<LazyRoute><PendingCases /></LazyRoute>} />
            <Route path="/pending-cases/:id" element={<LazyRoute><PendingCaseDetail /></LazyRoute>} />
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
            <Route path="/schedule" element={<LazyRoute><Schedule /></LazyRoute>} />
            <Route path="/calendar" element={<LazyRoute><Calendar /></LazyRoute>} />
          </Route>
          <Route element={<RequirePermission anyOf={["team.view"]} />}>
            <Route path="/investigators" element={<LazyRoute><Investigators /></LazyRoute>} />
            <Route path="/investigators/:id" element={<LazyRoute><InvestigatorDetail /></LazyRoute>} />
          </Route>
          <Route element={<RequirePermission anyOf={["team.invite"]} />}>
            <Route path="/investigators/new" element={<LazyRoute><InvestigatorNew /></LazyRoute>} />
          </Route>
          <Route element={<RequirePermission anyOf={["clients.view"]} />}>
            <Route path="/clients" element={<LazyRoute><Clients /></LazyRoute>} />
            <Route path="/clients/:id" element={<LazyRoute><ClientDetail /></LazyRoute>} />
          </Route>
          <Route element={<RequirePermission anyOf={["video.use"]} />}>
            <Route path="/video" element={<LazyRoute><VideoPlayer /></LazyRoute>} />
          </Route>
          <Route element={<RequirePermission anyOf={["admin.roles", "admin.users"]} />}>
            <Route path="/administration" element={<LazyRoute><Administration /></LazyRoute>} />
          </Route>
          <Route path="/profile" element={<LazyRoute><Profile /></LazyRoute>} />
          <Route path="/settings" element={<Navigate to="/profile" replace />} />
          <Route element={<RequirePermission anyOf={["assistant.use"]} />}>
            <Route path="/assistant" element={<LazyRoute><Assistant /></LazyRoute>} />
          </Route>
          <Route path="/reports" element={<LazyRoute><Reports /></LazyRoute>} />
          <Route element={<RequirePermission anyOf={["documents.generate"]} />}>
            <Route path="/documents" element={<LazyRoute><DocumentGenerator /></LazyRoute>} />
          </Route>

          {/* ── OSINT / Intelligence ── */}
          <Route element={<RequirePermission anyOf={["osint.view"]} />}>
            <Route path="/osint/investigations" element={<LazyRoute><OsintInvestigations /></LazyRoute>} />
            <Route path="/osint/investigations/new" element={<LazyRoute><OsintInvestigationNew /></LazyRoute>} />
            <Route path="/osint/investigations/:id" element={<LazyRoute><OsintInvestigationDetail /></LazyRoute>} />
            <Route path="/osint/globe" element={<LazyRoute><OsintGlobe /></LazyRoute>} />
            <Route path="/osint/reverse-search" element={<LazyRoute><OsintReverseSearch /></LazyRoute>} />
            <Route path="/osint/video-custody" element={<LazyRoute><OsintVideoCustody /></LazyRoute>} />
            <Route path="/osint/audio-tools" element={<LazyRoute><OsintAudioTools /></LazyRoute>} />
            <Route path="/osint/globe" element={<LazyRoute><OsintGodsEye /></LazyRoute>} />
            <Route path="/osint/video-evidence" element={<LazyRoute><OsintVideoEvidence /></LazyRoute>} />
            <Route path="/osint/medical-canvass" element={<LazyRoute><OsintMedicalCanvass /></LazyRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
