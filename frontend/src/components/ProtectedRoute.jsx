import { Navigate, Outlet } from "react-router-dom";

function ProtectedRoute() {
  // get the token from localStorage
  const token = localStorage.getItem("token");

  // no token means the user is not logged in, so redirect to the login page
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // token exists, so show the protected pages
  return <Outlet />;
}

export default ProtectedRoute;