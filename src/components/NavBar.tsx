import { useAuth0 } from "@auth0/auth0-react";
import { Link, useLocation } from "react-router-dom";

const NavBar = () => {
  const { isAuthenticated, user, loginWithRedirect, logout, isLoading } = useAuth0();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">
          <span className="logo-emoji">🍕</span>
          <span className="logo-text">Pizza 42</span>
        </Link>
      </div>

      <div className="navbar-links">
        <Link to="/" className={isActive("/") ? "active" : ""}>
          Home
        </Link>
        <Link to="/menu" className={isActive("/menu") ? "active" : ""}>
          Menu
        </Link>
        {isAuthenticated && (
          <>
            <Link to="/order" className={isActive("/order") ? "active" : ""}>
              Order
            </Link>
            <Link to="/orders" className={isActive("/orders") ? "active" : ""}>
              Order History
            </Link>
            <Link to="/profile" className={isActive("/profile") ? "active" : ""}>
              Profile
            </Link>
          </>
        )}
      </div>

      <div className="navbar-auth">
        {isLoading ? (
          <span className="loading-text">Loading...</span>
        ) : isAuthenticated && user ? (
          <div className="user-info">
            <img src={user.picture} alt={user.name} className="user-avatar" />
            <span className="user-name">{user.name}</span>
            <button
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              className="btn btn-outline"
            >
              Log Out
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => loginWithRedirect()} className="btn btn-outline">
              Log In
            </button>
            <button
              onClick={() => loginWithRedirect({ authorizationParams: { screen_hint: "signup" } })}
              className="btn btn-primary"
            >
              Sign Up
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
