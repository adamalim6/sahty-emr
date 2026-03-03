import { getGlobalPool } from './db/globalPg';

async function test() {
  console.log("Attempting to acquire client...");
  // Timeout added so we don't hang infinitely if exhausted
  const timeoutId = setTimeout(() => {
    console.error("TIMEOUT: Could not acquire connection after 3s!");
    process.exit(1);
  }, 3000);

  const globalPool = getGlobalPool();
  const client = await globalPool.connect();
  clearTimeout(timeoutId);
  console.log("Client acquired successfully! Executing query...");
  const res = await client.query('SELECT 1');
  console.log("Query success. Releasing.");
  client.release();
  console.log("Released.");
  process.exit(0);
}
test().catch(err => {
  console.error(err);
  process.exit(1);
});
