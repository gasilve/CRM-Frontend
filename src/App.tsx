import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import RequireAuth from "./components/auth/RequireAuth";
import RequireStaff from "./components/auth/RequireStaff";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import AcceptInvite from "./pages/auth/AcceptInvite";
import MfaSetup from "./pages/auth/MfaSetup";
import MfaVerify from "./pages/auth/MfaVerify";
import AwaitingAccess from "./pages/auth/AwaitingAccess";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Cases from "./pages/Cases";
import CaseDetail from "./pages/CaseDetail";
import Schedule from "./pages/Schedule";
import Investigators from "./pages/Investigators";
import InvestigatorNew from "./pages/InvestigatorNew";
import InvestigatorDetail from "./pages/InvestigatorDetail";
import Calendar from "./pages/Calendar";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Assistant from "./pages/Assistant";
import DocumentGenerator from "./pages/DocumentGenerator";
import VideoPlayer from "./pages/VideoPlayer";

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
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route element={<RequireStaff />}>
            <Route path="/cases" element={<Cases />} />
            <Route path="/cases/:id" element={<CaseDetail />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/investigators" element={<Investigators />} />
            <Route path="/investigators/new" element={<InvestigatorNew />} />
            <Route path="/investigators/:id" element={<InvestigatorDetail />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/video" element={<VideoPlayer />} />
          </Route>
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/documents" element={<DocumentGenerator />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
