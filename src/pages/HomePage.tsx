import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

const HomePage = () => {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <section className="hero">
        <h1>Welcome to Pizza 42</h1>
        <p className="hero-subtitle">
          The answer to life, the universe, and your pizza cravings
        </p>
        <div className="hero-actions">
          {isAuthenticated ? (
            <button onClick={() => navigate("/order")} className="btn btn-primary btn-lg">
              Order Now
            </button>
          ) : (
            <>
              <button
                onClick={() => loginWithRedirect({ authorizationParams: { screen_hint: "signup" } })}
                className="btn btn-primary btn-lg"
              >
                Sign Up & Order
              </button>
              <button onClick={() => navigate("/menu")} className="btn btn-outline btn-lg">
                View Menu
              </button>
            </>
          )}
        </div>
      </section>

      <section className="features">
        <div className="feature-card">
          <span className="feature-icon">🔐</span>
          <h3>Secure Login</h3>
          <p>Multiple authentication options including Google, Email/Password, and Passkeys</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">🍕</span>
          <h3>Fresh Pizzas</h3>
          <p>Hand-crafted pizzas made with premium ingredients and love</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">🚀</span>
          <h3>Fast Delivery</h3>
          <p>Hot pizza at your door in 30-42 minutes or it's free</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">📋</span>
          <h3>Order History</h3>
          <p>Track all your orders and reorder your favorites instantly</p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
