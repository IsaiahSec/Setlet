import "./App.css";
import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate
} from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MySets from "./pages/MySets";
import PublicSets from "./pages/PublicSets";
import SetEditor from "./pages/SetEditor";
import StudyReview from "./pages/StudyReview";
import FlipThrough from "./pages/FlipThrough";
import PublicSetView from "./pages/PublicSetView";

import ProtectedRoute from "./components/ProtectedRoute";
import { getToken, clearToken } from "./services/api";

// navigation bar shown only when the user is logged in
function Navigation({ isLoggedIn, onLogout }) {
  const navigate = useNavigate();

  function handleLogout() {
    onLogout();
    navigate("/login", { replace: true });
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <nav>
      <Link to="/mysets">My Sets</Link>
      {" | "}
      <Link to="/public">Public Sets</Link>
      {" | "}
      <button type="button" onClick={handleLogout}>
        Log out
      </button>
    </nav>
  );
}

// redirect users based on login status
function HomeRedirect({ isLoggedIn }) {
  if (isLoggedIn) {
    return <Navigate to="/mysets" replace />;
  }

  return <Navigate to="/login" replace />;
}

function App() {
  // keep login status in React state
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => Boolean(getToken())
  );

  function handleLogin() {
    setIsLoggedIn(true);
  }

  function handleLogout() {
    clearToken();
    setIsLoggedIn(false);
  }

  return (
    <BrowserRouter>
      <Navigation
        isLoggedIn={isLoggedIn}
        onLogout={handleLogout}
      />

      <Routes>
        {/* home page */}
        <Route
          path="/"
          element={<HomeRedirect isLoggedIn={isLoggedIn} />}
        />

        {/* pages anyone can see */}
        <Route
          path="/login"
          element={<Login onLogin={handleLogin} />}
        />
        <Route path="/signup" element={<Signup />} />

        {/* pages only logged in users can see */}
        <Route element={<ProtectedRoute />}>
          <Route path="/mysets" element={<MySets />} />
          <Route path="/mysets/:setId" element={<SetEditor />} />
          <Route path="/public" element={<PublicSets />} />
          <Route path="/public/:setId" element={<PublicSetView />} />
          <Route path="/study/:setId" element={<StudyReview />} />
          <Route path="/flip/:setId" element={<FlipThrough />} />
        </Route>

        {/* unknown paths redirect home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
