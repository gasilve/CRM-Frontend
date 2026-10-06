import { installRootScale } from "./lib/root-scale";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { PendingIntakeProvider } from "./contexts/PendingIntakeContext";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";

installRootScale();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <BackgroundProvider>
      <BrowserRouter basename="/admin">
        <AuthProvider>
          <PendingIntakeProvider>
            <App />
          </PendingIntakeProvider>
        </AuthProvider>
      </BrowserRouter>
    </BackgroundProvider>
  </ThemeProvider>,
);
