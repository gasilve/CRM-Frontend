import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "gridstack/dist/gridstack.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <BackgroundProvider>
      <BrowserRouter basename="/admin">
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </BackgroundProvider>
  </ThemeProvider>,
);
