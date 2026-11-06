import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CreateRoom from "./pages/CreateRoom";
import HostRoom from "./pages/HostRoom";
import JoinRoom from "./pages/JoinRoom";
import NotFound from "./pages/NotFound";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/host" element={<CreateRoom />} />
          <Route path="/room/:roomId" element={<HostRoom />} />
          <Route path="/join/:roomId" element={<JoinRoom />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
