import { useState, useEffect } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import { authConfig, getApiUrl } from "../auth-config";

interface Order {
  orderId: string;
  pizza: {
    name: string;
    size: string;
    extras: string[];
  };
  quantity: number;
  total: number;
  orderedAt: string;
  status: string;
}

const OrderHistoryPage = () => {
  const { user, getAccessTokenSilently } = useAuth0();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: authConfig.audience,
          },
        });

        const response = await fetch(`${getApiUrl()}/orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setOrders(data.orders || []);
        } else {
          // Fallback to token claims if API fails
          const tokenOrders = user?.["https://pizza42.com/order_history"] as Order[] | undefined;
          if (tokenOrders) {
            setOrders(tokenOrders);
          } else {
            setError("Failed to fetch orders");
          }
        }
      } catch (err) {
        // Fallback to token claims
        const tokenOrders = user?.["https://pizza42.com/order_history"] as Order[] | undefined;
        if (tokenOrders) {
          setOrders(tokenOrders);
        } else {
          setError("Failed to fetch orders");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [getAccessTokenSilently, user]);

  if (isLoading) {
    return <div className="loading">Loading order history...</div>;
  }

  return (
    <div className="order-history-page">
      <h1>Order History</h1>

      {error && <div className="alert alert-error">{error}</div>}

      {orders.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📦</span>
          <h3>No orders yet</h3>
          <p>Place your first order to see it here!</p>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.orderId} className="order-card">
              <div className="order-header">
                <span className="order-id">Order #{order.orderId}</span>
                <span className={`order-status status-${order.status?.toLowerCase() || "completed"}`}>
                  {order.status || "Completed"}
                </span>
              </div>
              <div className="order-details">
                <p className="pizza-name">
                  <strong>{order.pizza.name}</strong> - {order.pizza.size}
                </p>
                {order.pizza.extras?.length > 0 && (
                  <p className="pizza-extras">Extras: {order.pizza.extras.join(", ")}</p>
                )}
                <p>Quantity: {order.quantity}</p>
                <p className="order-date">
                  Ordered: {new Date(order.orderedAt).toLocaleDateString()} at{" "}
                  {new Date(order.orderedAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="order-total">
                <strong>${order.total.toFixed(2)}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default withAuthenticationRequired(OrderHistoryPage, {
  onRedirecting: () => <div className="loading">Redirecting to login...</div>,
});
