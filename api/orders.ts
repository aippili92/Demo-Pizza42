import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auth } from 'express-oauth2-jwt-bearer';

// Management API token caching
let mgmtToken: string | null = null;
let mgmtTokenExpiry: number | null = null;

// Get Management API token
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

  const data = await response.json();
  mgmtToken = data.access_token;
  mgmtTokenExpiry = Date.now() + data.expires_in * 1000;
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
  return response.json();
}

// Verify JWT token
async function verifyToken(authHeader: string | undefined): Promise<{ sub: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Fetch JWKS
    const jwksResponse = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
    );
    const jwks = await jwksResponse.json();

    // Decode token header to get kid
    const [headerB64] = token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64').toString());

    // Find the key
    const key = jwks.keys.find((k: { kid: string }) => k.kid === header.kid);
    if (!key) return null;

    // For simplicity, we'll verify with Auth0's userinfo endpoint
    const userInfoResponse = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/userinfo`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!userInfoResponse.ok) return null;

    const userInfo = await userInfoResponse.json();
    return { sub: userInfo.sub };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify token
  const payload = await verifyToken(req.headers.authorization);
  if (!payload) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing token' });
  }

  const userId = payload.sub;

  if (req.method === 'GET') {
    // Get orders
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
    // Create order
    try {
      const { pizza, quantity, deliveryAddress, total, orderedAt } = req.body;

      if (!pizza || !quantity || !deliveryAddress || !total) {
        return res.status(400).json({ error: 'invalid_request', message: 'Missing required fields' });
      }

      const user = await getUser(userId);
      if (!user.email_verified) {
        return res.status(403).json({
          error: 'email_not_verified',
          message: 'Please verify your email before placing orders',
        });
      }

      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const order = {
        orderId,
        pizza,
        quantity,
        deliveryAddress,
        total,
        orderedAt: orderedAt || new Date().toISOString(),
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
