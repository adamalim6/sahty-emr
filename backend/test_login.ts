import { authUserRepository } from './repositories/authUserRepository';

async function test() {
    try {
        console.log("Testing global login...");
        const gUser = await authUserRepository.findByUsername('admin', 'global');
        console.log("Global result:", gUser ? "Found" : "Not Found");

        console.log("Testing tenant login...");
        const tUser = await authUserRepository.findByUsername('admin', 'tenant', 'ced91ced-fe46-45d1-8ead-b5d51bad5895');
        console.log("Tenant result:", tUser ? "Found" : "Not Found");
        process.exit(0);
    } catch (e) {
        console.error("Crash!", e);
        process.exit(1);
    }
}

test();
