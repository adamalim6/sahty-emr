import { surveillanceService } from './src/services/surveillanceService';

async function test() {
    console.log("Testing manual Apports write...");
    try {
        const bucket = await surveillanceService.updateCell(
            'ced91ced-fe46-45d1-8ead-b5d51bad5895',
            'a720c03a-f492-46e6-ae4d-14f639392087',
            new Date().toISOString(),
            '995df62d-4083-4f19-8136-6d0a730b181b', // parameter_id for APPORTS_HYD_CR_MAN
            'APPORTS_HYD_CR_MAN',
            250,
            'a720c03a-f492-46e6-ae4d-14f639392087', // Mock user UUID
            'Test',
            'User'
        );
        console.log("Success! Bucket returned:", JSON.stringify(bucket, null, 2));
    } catch(e) {
        console.error("FATAL ERROR:", e);
    }
    process.exit(0);
}
test().catch(console.error);
