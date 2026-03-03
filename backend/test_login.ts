import { authService } from './services/authService';
import { closeAllTenantPools } from './db/tenantPg';
import { closeGlobalPool } from './db/globalPg';

async function test() {
    console.log("Starting login test...");
    try {
        const start = Date.now();
        const res = await authService.login("medt", "password");
        console.log("Login result:", res ? "Success" : "Failed");
        console.log(`Time taken: ${Date.now() - start}ms`);
    } catch (err) {
        console.error("Crash during login:", err);
    } finally {
        await closeAllTenantPools();
        await closeGlobalPool();
        process.exit(0);
    }
}
test();
