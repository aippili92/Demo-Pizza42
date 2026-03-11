import express from "express";
import cors from "cors";
import dotenv from "dotenv";
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

// Get Management API token
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

  const data = await response.json();
  mgmtToken = data.access_token;
  mgmtTokenExpiry = Date.now() + data.expires_in * 1000;
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
    const { pizza, quantity, deliveryAddress, total, orderedAt } = req.body;

    // Validate request body
    if (!pizza || !quantity || !deliveryAddress || !total) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Missing required fields",
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

    // Generate order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Build order object
    const order = {
      orderId,
      pizza,
      quantity,
      deliveryAddress,
      total,
      orderedAt: orderedAt || new Date().toISOString(),
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
