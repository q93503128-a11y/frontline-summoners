export const SERVER_BOOTSTRAP_STATUS = 'cloudflare-bindings-pending' as const;

// Workers / Durable Objects / D1 bindings are added after the Cloudflare
// resources are provisioned. The battle rules themselves live in packages/sim.
