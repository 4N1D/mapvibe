import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

async function enableMocking() {
  const useMock = import.meta.env.VITE_USE_MOCK_SEARCH === "true";

  if (useMock) {
    const { worker } = await import("./mocks/browser");

    return worker.start({
      onUnhandledRequest: "bypass",
    });
  }
}

enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
