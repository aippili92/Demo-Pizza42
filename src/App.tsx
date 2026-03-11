import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import NavBar from "./components/NavBar";
import EmailVerificationBanner from "./components/EmailVerificationBanner";
import HomePage from "./pages/HomePage";
import MenuPage from "./pages/MenuPage";
import OrderPage from "./pages/OrderPage";
import OrderHistoryPage from "./pages/OrderHistoryPage";
import ProfilePage from "./pages/ProfilePage";
import CallbackPage from "./pages/CallbackPage";

function App() {
  const { isLoading, error, isAuthenticated, user } = useAuth0();

  useEffect(() => {
    if (error) {
      console.error("Auth0 Error:", error);
    }
    if (isAuthenticated && user) {
      console.log("User authenticated:", user);
    }
  }, [error, isAuthenticated, user]);

  if (error) {
    return (
      <div className="app-loading">
        <h2>Authentication Error</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.href = "/"} className="btn btn-primary">
          Go Home
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <NavBar />
      <EmailVerificationBanner />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/order" element={<OrderPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/callback" element={<CallbackPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <p>&copy; 2024 Pizza 42 - The Answer to All Your Pizza Questions</p>
      </footer>
    </div>
  );
}

export default App;
