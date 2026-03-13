import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as jose from 'jose';

// Menu data for server-side price calculation (must match frontend menu.ts)
const PIZZA_MENU: Record<string, { name: string; price: number }> = {
  'margherita': { name: 'Margherita', price: 14.42 },
  'pepperoni': { name: 'Pepperoni', price: 16.42 },
  'hawaiian': { name: 'Hawaiian', price: 17.42 },
  'veggie': { name: 'Veggie Supreme', price: 18.42 },
  'bbq-chicken': { name: 'BBQ Chicken', price: 19.42 },
  'meat-lovers': { name: 'Meat Lovers', price: 21.42 },
};

const PIZZA_SIZES: Record<string, number> = {
  'small': 1.0,
  'large': 1.4,
};

const EXTRA_TOPPINGS: Record<string, number> = {
  'extra-cheese': 2.0,
  'mushrooms': 1.5,
  'jalapenos': 1.0,
  'olives': 1.5,
  'bacon': 2.5,
};

// Rate limiting: track requests per user
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // max 10 orders per minute

function checkRateLimit(userId: string): boolean {
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

// Management API token caching
let mgmtToken: string | null = null;
let mgmtTokenExpiry: number | null = null;

// Get Management API token with proper error handling
async function getManagementToken(): Promise<string> {
  if (mgmtToken && mgmtTokenExpiry && Date.now() < mgmtTokenExpiry - 60000) {
    return mgmtToken;
  }

  const response = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.AUTH0_MGMT_CLIENT_ID,
      client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Management API token fetch failed:', response.status, errorText);
    throw new Error(`Failed to obtain Management API token: ${response.status}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    console.error('Management API response missing access_token:', data);
    throw new Error('Management API response missing access_token');
  }

  mgmtToken = data.access_token;
  mgmtTokenExpiry = Date.now() + (data.expires_in || 86400) * 1000;
  return mgmtToken!;
}

// Get user from Management API
async function getUser(userId: string) {
  const token = await getManagementToken();
  const response = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to fetch user:', response.status, errorText);
    throw new Error(`Failed to fetch user: ${response.status}`);
  }

  return response.json();
}

// Update user metadata
async function updateUserMetadata(userId: string, metadata: Record<string, unknown>) {
  const token = await getManagementToken();
  const response = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_metadata: metadata }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to update user metadata:', response.status, errorText);
    throw new Error(`Failed to update user metadata: ${response.status}`);
  }

  return response.json();
}

// JWKS cache for token verification
let jwksCache: jose.JWTVerifyGetKey | null = null;

// Verify JWT token with proper cryptographic verification
async function verifyToken(authHeader: string | undefined): Promise<{ sub: string; scope?: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Create JWKS client if not cached (will be reused across warm invocations)
    if (!jwksCache) {
      const jwksUrl = new URL(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`);
      jwksCache = jose.createRemoteJWKSet(jwksUrl);
    }

    // Cryptographically verify the JWT signature and claims
    const { payload } = await jose.jwtVerify(token, jwksCache, {
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      audience: process.env.AUTH0_AUDIENCE,
      algorithms: ['RS256'],
    });

    if (!payload.sub) {
      console.error('Token missing sub claim');
      return null;
    }

    return {
      sub: payload.sub,
      scope: typeof payload.scope === 'string' ? payload.scope : undefined,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// Check if token has required scope
function hasScope(tokenScope: string | undefined, requiredScope: string): boolean {
  if (!tokenScope) return false;
  const scopes = tokenScope.split(' ');
  return scopes.includes(requiredScope);
}

// Calculate order total server-side
function calculateOrderTotal(
  pizzaId: string,
  sizeId: string,
  extras: string[],
  quantity: number
): number | null {
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
  return Math.round(total * 100) / 100; // Round to 2 decimal places
}

// Sanitize and validate delivery address
function sanitizeDeliveryAddress(address: unknown): string | null {
  if (typeof address !== 'string') return null;

  // Trim and limit length (max 500 characters)
  const sanitized = address.trim().slice(0, 500);

  // Must have some content
  if (sanitized.length < 10) return null;

  return sanitized;
}

// Allowed origins for CORS (no wildcard fallback)
function getAllowedOrigin(requestOrigin: string | undefined): string | null {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173', // Local dev
    'http://localhost:5174',
    'http://localhost:3000',
  ].filter(Boolean) as string[];

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers - no wildcard, validate origin
  const requestOrigin = req.headers.origin as string | undefined;
  const allowedOrigin = getAllowedOrigin(requestOrigin);

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify token with proper cryptographic verification
  const payload = await verifyToken(req.headers.authorization);
  if (!payload) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  }

  const userId = payload.sub;

  // Rate limiting check
  if (!checkRateLimit(userId)) {
    return res.status(429).json({
      error: 'rate_limit_exceeded',
      message: 'Too many requests. Please wait before placing another order.',
    });
  }

  if (req.method === 'GET') {
    // Get orders - no special scope required (user can always view their own orders)
    try {
      const user = await getUser(userId);
      const orders = user.user_metadata?.orders || [];
      return res.status(200).json({ orders });
    } catch (error) {
      console.error('Fetch orders error:', error);
      return res.status(500).json({ error: 'server_error', message: 'Failed to fetch orders' });
    }
  }

  if (req.method === 'POST') {
    // Create order - requires place:order scope
    if (!hasScope(payload.scope, 'place:order')) {
      return res.status(403).json({
        error: 'insufficient_scope',
        message: 'Token does not have place:order permission',
      });
    }

    try {
      const { pizza, quantity, deliveryAddress } = req.body;

      // Validate required fields
      if (!pizza?.id || !pizza?.size || !quantity) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'Missing required fields: pizza.id, pizza.size, quantity',
        });
      }

      // Validate and sanitize delivery address
      const sanitizedAddress = sanitizeDeliveryAddress(deliveryAddress);
      if (!sanitizedAddress) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'Invalid delivery address. Must be at least 10 characters.',
        });
      }

      // Validate quantity
      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty < 1 || qty > 20) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'Invalid quantity. Must be between 1 and 20.',
        });
      }

      // Validate pizza exists in menu
      if (!PIZZA_MENU[pizza.id]) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'Invalid pizza selection.',
        });
      }

      // Calculate total server-side (NEVER trust client-provided total)
      const extras = Array.isArray(pizza.extras) ? pizza.extras : [];
      const calculatedTotal = calculateOrderTotal(pizza.id, pizza.size, extras, qty);

      if (calculatedTotal === null) {
        return res.status(400).json({
          error: 'invalid_request',
          message: 'Invalid pizza configuration.',
        });
      }

      const user = await getUser(userId);
      if (!user.email_verified) {
        return res.status(403).json({
          error: 'email_not_verified',
          message: 'Please verify your email before placing orders',
        });
      }

      // Generate secure order ID using crypto
      const orderId = `ORD-${Date.now()}-${crypto.randomUUID().split('-')[0].toUpperCase()}`;

      // Server-controlled timestamp (NEVER trust client timestamp)
      const serverTimestamp = new Date().toISOString();

      const order = {
        orderId,
        pizza: {
          id: pizza.id,
          name: PIZZA_MENU[pizza.id].name,
          size: pizza.size,
          extras: extras.filter((e: string) => EXTRA_TOPPINGS[e] !== undefined),
        },
        quantity: qty,
        deliveryAddress: sanitizedAddress,
        total: calculatedTotal,
        orderedAt: serverTimestamp,
        status: 'Completed',
      };

      const existingOrders = user.user_metadata?.orders || [];
      const updatedOrders = [order, ...existingOrders].slice(0, 50);

      await updateUserMetadata(userId, { orders: updatedOrders });

      return res.status(201).json({
        message: 'Order placed successfully!',
        orderId,
        estimatedDelivery: '30-42 minutes',
        order,
      });
    } catch (error) {
      console.error('Order error:', error);
      return res.status(500).json({ error: 'server_error', message: 'Failed to process order' });
    }
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
