import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";

const NAMESPACE = "https://pizza42.com";

const getTierColor = (tier: string) => {
  switch (tier) {
    case "gold": return "#FFD700";
    case "silver": return "#C0C0C0";
    case "bronze": return "#CD7F32";
    default: return "#6b7280";
  }
};

const ProfilePage = () => {
  const { user } = useAuth0();

  if (!user) return null;

  // Get custom claims from ID token
  const totalOrders = user[`${NAMESPACE}/total_orders`] as number || 0;
  const customerTier = user[`${NAMESPACE}/customer_tier`] as string || "new";
  const totalSpend = user[`${NAMESPACE}/total_spend`] as number || 0;
  const favoritePizza = user[`${NAMESPACE}/favorite_pizza`] as string || null;
  const lastOrderAt = user[`${NAMESPACE}/last_order_at`] as string || null;
  const firstOrderAt = user[`${NAMESPACE}/first_order_at`] as string || null;
  const orderHistory = user[`${NAMESPACE}/order_history`] as Array<{
    orderId: string;
    pizza: string | { id: string; name: string; size: string; extras?: string[] };
    total: number;
    orderedAt: string;
    status: string;
  }> || [];

  // Helper to get pizza name from order (handles both string and object formats)
  const getPizzaName = (pizza: string | { name: string } | undefined): string => {
    if (!pizza) return "Unknown";
    if (typeof pizza === "string") return pizza;
    return pizza.name || "Unknown";
  };

  // Format date helper
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="profile-page">
      <h1>Profile</h1>

      <div className="profile-card">
        <img src={user.picture} alt={user.name} className="profile-avatar" />
        <div className="profile-info">
          <h2>{user.name}</h2>
          <p className="profile-email">
            {user.email}
            {user.email_verified ? (
              <span className="badge badge-success">Verified</span>
            ) : (
              <span className="badge badge-warning">Not Verified</span>
            )}
          </p>
        </div>
      </div>

      <div className="profile-section">
        <h3>Customer Status</h3>
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">Customer Tier</span>
            <span
              className="detail-value"
              style={{
                color: getTierColor(customerTier),
                fontWeight: 700,
                textTransform: "uppercase"
              }}
            >
              {customerTier === "new" ? "🆕 New Customer" :
               customerTier === "bronze" ? "🥉 Bronze" :
               customerTier === "silver" ? "🥈 Silver" :
               customerTier === "gold" ? "🥇 Gold" : customerTier}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Orders</span>
            <span className="detail-value">{totalOrders}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Next Tier</span>
            <span className="detail-value">
              {customerTier === "new" && "1 order for Bronze"}
              {customerTier === "bronze" && `${5 - totalOrders} orders for Silver`}
              {customerTier === "silver" && `${10 - totalOrders} orders for Gold`}
              {customerTier === "gold" && "🎉 Max tier reached!"}
            </span>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h3>Marketing Insights (from ID Token)</h3>
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">Lifetime Value</span>
            <span className="detail-value" style={{ color: "#2a9d8f", fontWeight: 600 }}>
              ${totalSpend.toFixed(2)}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Favorite Pizza</span>
            <span className="detail-value">
              {favoritePizza ? `🍕 ${favoritePizza}` : "No orders yet"}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Last Order</span>
            <span className="detail-value">{formatDate(lastOrderAt)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Customer Since</span>
            <span className="detail-value">{formatDate(firstOrderAt)}</span>
          </div>
        </div>
      </div>

      {orderHistory.length > 0 && (
        <div className="profile-section">
          <h3>Recent Orders (from ID Token)</h3>
          <div className="mini-orders-list">
            {orderHistory.slice(0, 5).map((order) => (
              <div key={order.orderId} className="mini-order-item">
                <span className="mini-order-pizza">{getPizzaName(order.pizza)}</span>
                <span className="mini-order-total">${order.total?.toFixed(2)}</span>
                <span className="mini-order-date">
                  {new Date(order.orderedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="profile-section">
        <h3>Account Details</h3>
        <div className="details-grid">
          <div className="detail-item">
            <span className="detail-label">Nickname</span>
            <span className="detail-value">{user.nickname || "N/A"}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">User ID</span>
            <span className="detail-value">{user.sub}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Last Updated</span>
            <span className="detail-value">
              {user.updated_at ? new Date(user.updated_at).toLocaleString() : "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h3>ID Token Claims (Demo)</h3>
        <p className="token-disclaimer">
          Custom claims from Auth0 that power personalization:
        </p>
        <div className="token-display">
          <pre>{JSON.stringify({
            // Only show non-sensitive, relevant claims for demo
            name: user.name,
            email_verified: user.email_verified,
            [`${NAMESPACE}/customer_tier`]: customerTier,
            [`${NAMESPACE}/total_orders`]: totalOrders,
            [`${NAMESPACE}/total_spend`]: totalSpend,
            [`${NAMESPACE}/favorite_pizza`]: favoritePizza,
            [`${NAMESPACE}/last_order_at`]: lastOrderAt,
            [`${NAMESPACE}/first_order_at`]: firstOrderAt,
            [`${NAMESPACE}/order_history`]: `[${orderHistory.length} orders]`,
          }, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};

export default withAuthenticationRequired(ProfilePage, {
  onRedirecting: () => <div className="loading">Redirecting to login...</div>,
});
