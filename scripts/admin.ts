import "dotenv/config";
import { getPool } from "../lib/db";
import { ensureDefaultAdmin } from "../lib/auth";

async function run() {
  await ensureDefaultAdmin();
  // eslint-disable-next-line no-console
  console.log("[admin] usuario inicial listo");
  process.exit(0);
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
