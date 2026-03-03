import { prescriptionService } from '../services/prescriptionService';
import { tenantQuery } from '../db/tenantPg';

async function run() {
    const tenantId = 'ced91ced-fe46-45d1-8ead-b5d51bad5895';
    // Use an existing prescription event ID or create a dummy one
    const pId = '4c23f276-6644-4dec-9f79-826d9c6eadd0';
    const userId = 'a04e92f1-4705-47c8-b4df-fd37ef3cb6a6';

    console.log("--- 1. FIRST START ---");
    const d1 = new Date("2026-03-03T01:21:00.000Z");
    await prescriptionService.logAdministrationAction(tenantId, pId, 'started', { occurredAt: d1, performedByUserId: userId });

    console.log("--- 2. FIRST END ---");
    const d2 = new Date("2026-03-03T03:51:00.000Z");
    await prescriptionService.logAdministrationAction(tenantId, pId, 'ended', { occurredAt: d2, performedByUserId: userId });

    console.log("\n--- DB STATE AFTER FIRST PAIR ---");
    const res1 = await tenantQuery<any>(tenantId, 'SELECT action_type, occurred_at, status, linked_event_id FROM administration_events WHERE prescription_event_id = $1 ORDER BY created_at ASC', [pId]);
    console.table(res1);

    console.log("\n--- 3. USER MOVES SLIDER AND SAVES NEW START + END ---");
    const d3 = new Date("2026-03-03T02:21:00.000Z"); // Moved 1h later
    await prescriptionService.logAdministrationAction(tenantId, pId, 'started', { occurredAt: d3, performedByUserId: userId });
    const d4 = new Date("2026-03-03T04:51:00.000Z"); // Moved 1h later
    await prescriptionService.logAdministrationAction(tenantId, pId, 'ended', { occurredAt: d4, performedByUserId: userId });

    console.log("\n--- DB STATE AFTER SLIDER MOVE ---");
    const res2 = await tenantQuery<any>(tenantId, 'SELECT action_type, occurred_at, status, cancellation_reason, linked_event_id FROM administration_events WHERE prescription_event_id = $1 ORDER BY created_at ASC', [pId]);
    console.table(res2);
    
    // Clear out for actual use
    await tenantQuery(tenantId, 'DELETE FROM administration_events WHERE prescription_event_id = $1', [pId]);
    process.exit(0);
}
run();
