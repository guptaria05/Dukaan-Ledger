import "dotenv/config";
import app from "./app.js";
import { pool } from "./db.js";

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => {
  console.log(`Dukaan Ledger API listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down gracefully`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
