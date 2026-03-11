export const authConfig = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE,
  scope: "openid profile email create:orders",
};

export const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || "/api";
};
