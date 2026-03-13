import { useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import type { Pizza, PizzaSize, ExtraTopping } from "../data/menu";
import { PIZZA_MENU, PIZZA_SIZES, EXTRA_TOPPINGS } from "../data/menu";
import { authConfig, getApiUrl } from "../auth-config";

const OrderPage = () => {
  const { user, getAccessTokenSilently } = useAuth0();
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [selectedSize, setSelectedSize] = useState<PizzaSize>(PIZZA_SIZES[0]);
  const [selectedExtras, setSelectedExtras] = useState<ExtraTopping[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string; orderId?: string } | null>(null);

  const isEmailVerified = user?.email_verified;

  const calculateTotal = () => {
    if (!selectedPizza) return 0;
    const basePrice = selectedPizza.price * selectedSize.priceMultiplier;
    const extrasPrice = selectedExtras.reduce((sum, extra) => sum + extra.price, 0);
    return (basePrice + extrasPrice) * quantity;
  };

  const handleExtraToggle = (extra: ExtraTopping) => {
    setSelectedExtras((prev) =>
      prev.find((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const handleSubmit = async () => {
    if (!selectedPizza || deliveryAddress.trim().length < 10) return;

    setIsSubmitting(true);
    setOrderResult(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: authConfig.audience,
          scope: "place:order",
        },
      });

      // Send IDs to server - server calculates total and timestamp
      const orderData = {
        pizza: {
          id: selectedPizza.id,
          size: selectedSize.id,
          extras: selectedExtras.map((e) => e.id),
        },
        quantity,
        deliveryAddress,
      };

      const response = await fetch(`${getApiUrl()}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (response.ok) {
        setOrderResult({
          success: true,
          message: `Order placed successfully! Estimated delivery: ${data.estimatedDelivery}`,
          orderId: data.orderId,
        });
        // Reset form
        setSelectedPizza(null);
        setSelectedSize(PIZZA_SIZES[0]);
        setSelectedExtras([]);
        setQuantity(1);
        setDeliveryAddress("");
      } else {
        if (data.error === "email_not_verified") {
          setOrderResult({
            success: false,
            message: "Please verify your email before placing orders.",
          });
        } else {
          setOrderResult({
            success: false,
            message: data.message || "Failed to place order. Please try again.",
          });
        }
      }
    } catch (error) {
      console.error("Order error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setOrderResult({
        success: false,
        message: `Error: ${errorMessage}`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="order-page">
      <h1>Place Your Order</h1>

      {!isEmailVerified && (
        <div className="alert alert-warning">
          <strong>Email verification required:</strong> You must verify your email to place orders.
        </div>
      )}

      {orderResult && (
        <div className={`alert ${orderResult.success ? "alert-success" : "alert-error"}`}>
          {orderResult.message}
          {orderResult.orderId && <p>Order ID: {orderResult.orderId}</p>}
        </div>
      )}

      <div className="order-form">
        <section className="order-section">
          <h2>1. Choose Your Pizza</h2>
          <div className="pizza-select-grid">
            {PIZZA_MENU.map((pizza) => (
              <div
                key={pizza.id}
                className={`pizza-select-card ${selectedPizza?.id === pizza.id ? "selected" : ""}`}
                onClick={() => setSelectedPizza(pizza)}
              >
                <span className="pizza-emoji">{pizza.emoji}</span>
                <h4>{pizza.name}</h4>
                <p className="pizza-price">${pizza.price.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </section>

        {selectedPizza && (
          <>
            <section className="order-section">
              <h2>2. Select Size</h2>
              <div className="size-options">
                {PIZZA_SIZES.map((size) => (
                  <label key={size.id} className="size-option">
                    <input
                      type="radio"
                      name="size"
                      checked={selectedSize.id === size.id}
                      onChange={() => setSelectedSize(size)}
                    />
                    <span>{size.name}</span>
                    {size.priceMultiplier > 1 && (
                      <span className="price-modifier">+{((size.priceMultiplier - 1) * 100).toFixed(0)}%</span>
                    )}
                  </label>
                ))}
              </div>
            </section>

            <section className="order-section">
              <h2>3. Extra Toppings (Optional)</h2>
              <div className="extras-options">
                {EXTRA_TOPPINGS.map((extra) => (
                  <label key={extra.id} className="extra-option">
                    <input
                      type="checkbox"
                      checked={selectedExtras.some((e) => e.id === extra.id)}
                      onChange={() => handleExtraToggle(extra)}
                    />
                    <span>{extra.name}</span>
                    <span className="extra-price">+${extra.price.toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="order-section">
              <h2>4. Quantity</h2>
              <div className="quantity-control">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="qty-btn"
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <span className="qty-value">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(20, quantity + 1))}
                  className="qty-btn"
                  disabled={quantity >= 20}
                >
                  +
                </button>
              </div>
            </section>

            <section className="order-section">
              <h2>5. Delivery Address</h2>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter your delivery address..."
                className="address-input"
                rows={3}
              />
            </section>

            <section className="order-summary">
              <h2>Order Summary</h2>
              <div className="summary-details">
                <p>
                  <strong>{selectedPizza.name}</strong> ({selectedSize.name})
                </p>
                {selectedExtras.length > 0 && (
                  <p>Extras: {selectedExtras.map((e) => e.name).join(", ")}</p>
                )}
                <p>Quantity: {quantity}</p>
                <p className="total">
                  <strong>Total: ${calculateTotal().toFixed(2)}</strong>
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={deliveryAddress.trim().length < 10 || !isEmailVerified || isSubmitting}
                className="btn btn-primary btn-lg submit-order"
              >
                {isSubmitting
                  ? "Placing Order..."
                  : !isEmailVerified
                  ? "Verify Email to Order"
                  : deliveryAddress.trim().length < 10
                  ? "Enter Address (min 10 chars)"
                  : "Place Order"}
              </button>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default withAuthenticationRequired(OrderPage, {
  onRedirecting: () => <div className="loading">Redirecting to login...</div>,
});
