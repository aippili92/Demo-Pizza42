import { useAuth0 } from "@auth0/auth0-react";

const EmailVerificationBanner = () => {
  const { user, isAuthenticated } = useAuth0();

  if (!isAuthenticated || !user || user.email_verified) {
    return null;
  }

  return (
    <div className="email-verification-banner">
      <span className="banner-icon">⚠️</span>
      <div className="banner-content">
        <strong>Email not verified</strong>
        <p>
          Please verify your email address ({user.email}) to place orders.
          Check your inbox for a verification link.
        </p>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;
