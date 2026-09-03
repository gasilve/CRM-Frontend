import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { PendingIntakeProvider } from "./contexts/PendingIntakeContext";
import { BackgroundProvider } from "./contexts/BackgroundContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
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
    </ThemeProvider>
  </QueryClientProvider>,
);
