import { BrowserRouter, Routes, Route } from "react-router-dom";
import FacebookIntegrationPage from "./pages/FacebookIntegrationPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/facebook/:agentId" element={<FacebookIntegrationPage />} />
        {/* You can add more routes here */}
      </Routes>
    </BrowserRouter>
  );
}
