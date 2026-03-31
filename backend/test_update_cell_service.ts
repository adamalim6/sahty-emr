import { surveillanceService } from './services/surveillanceService';

async function test() {
    try {
        console.log("Testing updateCell service method...");
        const res = await surveillanceService.updateCell(
            'ced91ced-fe46-45d1-8ead-b5d51bad5895',
            'a720c03a-f492-46e6-ae4d-14f639392087',
            new Date().toISOString(),
            '995df62d-4083-4f19-8136-6d0a730b181b', // APPORTS_HYD_CR_MAN
            'APPORTS_HYD_CR_MAN',
            400,
            'a720c03a-f492-46e6-ae4d-14f639392087',
            'Test', 'User'
        );
        console.log("UPDATE CELL SUCCESS!", res);
    } catch(e: any) {
        console.error("UPDATE CELL FATAL CRASH:", e.message, e.code, e.detail);
    }
}
test().catch(console.error);
