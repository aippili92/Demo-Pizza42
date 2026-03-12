import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { auth, requiredScopes } from "express-oauth2-jwt-bearer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());

// JWT validation middleware
const checkJwt = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  tokenSigningAlg: "RS256",
});

// Management API token caching
let mgmtToken = null;
let mgmtTokenExpiry = null;

// Menu data for server-side price calculation
const PIZZA_MENU = {
  'margherita': { name: 'Margherita', price: 14.42 },
  'pepperoni': { name: 'Pepperoni', price: 16.42 },
  'hawaiian': { name: 'Hawaiian', price: 17.42 },
  'veggie': { name: 'Veggie Supreme', price: 18.42 },
  'bbq-chicken': { name: 'BBQ Chicken', price: 19.42 },
  'meat-lovers': { name: 'Meat Lovers', price: 21.42 },
};

const PIZZA_SIZES = {
  'small': 1.0,
  'large': 1.4,
};

const EXTRA_TOPPINGS = {
  'extra-cheese': 2.0,
  'mushrooms': 1.5,
  'jalapenos': 1.0,
  'olives': 1.5,
  'bacon': 2.5,
};

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Calculate order total server-side
function calculateOrderTotal(pizzaId, sizeId, extras, quantity) {
  const pizza = PIZZA_MENU[pizzaId];
  const sizeMultiplier = PIZZA_SIZES[sizeId];

  if (!pizza || !sizeMultiplier) {
    return null;
  }

  const basePrice = pizza.price * sizeMultiplier;

  let extrasPrice = 0;
  for (const extraId of extras) {
    const extraPrice = EXTRA_TOPPINGS[extraId];
    if (extraPrice !== undefined) {
      extrasPrice += extraPrice;
    }
  }

  const total = (basePrice + extrasPrice) * quantity;
  return Math.round(total * 100) / 100;
}

// Sanitize delivery address
function sanitizeDeliveryAddress(address) {
  if (typeof address !== 'string') return null;
  const sanitized = address.trim().slice(0, 500);
  if (sanitized.length < 10) return null;
  return sanitized;
}

// Get Management API token with proper error handling
async function getManagementToken() {
  if (mgmtToken && mgmtTokenExpiry && Date.now() < mgmtTokenExpiry - 60000) {
    return mgmtToken;
  }

  const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.AUTH0_MGMT_CLIENT_ID,
      client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Management API token fetch failed:", response.status, errorText);
    throw new Error(`Failed to obtain Management API token: ${response.status}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    console.error("Management API response missing access_token:", data);
    throw new Error("Management API response missing access_token");
  }

  mgmtToken = data.access_token;
  mgmtTokenExpiry = Date.now() + (data.expires_in || 86400) * 1000;
  return mgmtToken;
}

// Get user from Management API
async function getUser(userId) {
  const token = await getManagementToken();
  const response = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return response.json();
}

// Update user metadata
async function updateUserMetadata(userId, metadata) {
  const token = await getManagementToken();
  const response = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_metadata: metadata }),
    }
  );
  return response.json();
}

// Health check endpoint (public)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "Pizza 42 API" });
});

// Create order (protected)
app.post("/api/orders", checkJwt, requiredScopes("create:orders"), async (req, res) => {
  try {
    const userId = req.auth.payload.sub;

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return res.status(429).json({
        error: "rate_limit_exceeded",
        message: "Too many requests. Please wait before placing another order.",
      });
    }

    const { pizza, quantity, deliveryAddress } = req.body;

    // Validate required fields
    if (!pizza?.id || !pizza?.size || !quantity) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Missing required fields: pizza.id, pizza.size, quantity",
      });
    }

    // Validate and sanitize delivery address
    const sanitizedAddress = sanitizeDeliveryAddress(deliveryAddress);
    if (!sanitizedAddress) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Invalid delivery address. Must be at least 10 characters.",
      });
    }

    // Validate quantity
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1 || qty > 20) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Invalid quantity. Must be between 1 and 20.",
      });
    }

    // Validate pizza exists
    if (!PIZZA_MENU[pizza.id]) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Invalid pizza selection.",
      });
    }

    // Calculate total server-side (NEVER trust client)
    const extras = Array.isArray(pizza.extras) ? pizza.extras : [];
    const calculatedTotal = calculateOrderTotal(pizza.id, pizza.size, extras, qty);

    if (calculatedTotal === null) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Invalid pizza configuration.",
      });
    }

    // Get user to check email verification
    const user = await getUser(userId);
    if (!user.email_verified) {
      return res.status(403).json({
        error: "email_not_verified",
        message: "Please verify your email before placing orders",
      });
    }

    // Generate secure order ID
    const orderId = `ORD-${Date.now()}-${crypto.randomUUID().split("-")[0].toUpperCase()}`;

    // Server-controlled timestamp
    const serverTimestamp = new Date().toISOString();

    // Build order object with validated data
    const order = {
      orderId,
      pizza: {
        id: pizza.id,
        name: PIZZA_MENU[pizza.id].name,
        size: pizza.size,
        extras: extras.filter((e) => EXTRA_TOPPINGS[e] !== undefined),
      },
      quantity: qty,
      deliveryAddress: sanitizedAddress,
      total: calculatedTotal,
      orderedAt: serverTimestamp,
      status: "Completed",
    };

    // Get existing orders from user metadata
    const existingOrders = user.user_metadata?.orders || [];

    // Add new order and keep last 50
    const updatedOrders = [order, ...existingOrders].slice(0, 50);

    // Update user metadata
    await updateUserMetadata(userId, { orders: updatedOrders });

    res.status(201).json({
      message: "Order placed successfully!",
      orderId,
      estimatedDelivery: "30-42 minutes",
      order,
    });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({
      error: "server_error",
      message: "Failed to process order",
    });
  }
});

// Get orders (protected)
app.get("/api/orders", checkJwt, async (req, res) => {
  try {
    const userId = req.auth.payload.sub;
    const user = await getUser(userId);
    const orders = user.user_metadata?.orders || [];

    res.json({ orders });
  } catch (error) {
    console.error("Fetch orders error:", error);
    res.status(500).json({
      error: "server_error",
      message: "Failed to fetch orders",
    });
  }
});

// Error handler
app.use((err, req, res, next) => {
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      error: "unauthorized",
      message: "Invalid or missing token",
    });
  }
  if (err.name === "InsufficientScopeError") {
    return res.status(403).json({
      error: "insufficient_scope",
      message: "Token does not have required permissions",
    });
  }
  console.error(err);
  res.status(500).json({
    error: "server_error",
    message: "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Pizza 42 API running on port ${PORT}`);
});
