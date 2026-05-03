import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon, PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@db.localtest.me:5432/main";

function shouldUseLocalNeonProxy(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  try {
    return new URL(connectionString).hostname === "db.localtest.me";
  } catch {
    return false;
  }
}

// Neon serverless driver + local Postgres (docker-compose `--localtest-me` shim).
// CLI (`prisma db seed`, bootstrap) often runs without NODE_ENV=development — detect hostname too.
if (shouldUseLocalNeonProxy()) {
  neonConfig.fetchEndpoint = (host) => {
    const [protocol, port] =
      host === "db.localtest.me" ? ["http", 4444] : ["https", 443];
    return `${protocol}://${host}:${port}/sql`;
  };
  const connectionStringUrl = new URL(connectionString);
  neonConfig.useSecureWebSocket =
    connectionStringUrl.hostname !== "db.localtest.me";
  neonConfig.wsProxy = (host) =>
    host === "db.localtest.me" ? `${host}:4444/v2` : `${host}/v2`;
}
neonConfig.webSocketConstructor = ws;

// Prisma supports both HTTP and WebSocket clients. Choose the one that fits your needs:

// HTTP Client:
// - Ideal for stateless operations and quick queries
// - Lower overhead for single queries
const adapterHttp = new PrismaNeonHttp(connectionString!, {});
export const prismaClientHttp = new PrismaClient({ adapter: adapterHttp });

// WebSocket Client:
// - Best for long-running applications (like servers)
// - Maintains a persistent connection
// - More efficient for multiple sequential queries
// - Better for high-frequency database operations
const adapterWs = new PrismaNeon({ connectionString });
export const prisma = new PrismaClient({ adapter: adapterWs });
