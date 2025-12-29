
import { pharmacyService } from './services/pharmacyService';
import { Dispensation } from './models/serialized-pack';

const run = () => {
    // 1. Create a dummy dispensation
    const disp: Dispensation = {
        id: 'DISP-TEST-123',
        prescriptionId: 'PRESC-TEST',
        admissionId: 'ADM-TEST',
        productId: 'PROD-001',
        mode: 'UNIT' as any,
        quantity: 5,
        serializedPackId: 'PACK-123',
        lotNumber: 'LOT-123',
        expiryDate: new Date().toISOString(),
        serialNumber: 'SERIAL-123',
        unitPriceExclVAT: 10,
        vatRate: 20,
        totalPriceInclVAT: 12,
        dispensedAt: new Date(),
        dispensedBy: 'TEST_USER'
    };

    // Inject into service (hacky but works for test)
    (pharmacyService as any).dispensations.push(disp);
    (pharmacyService as any).saveData();

    console.log('Initial Dispensation:', disp);

    // 2. Mark as partially returned
    console.log('Returning 2 units...');
    pharmacyService.markDispensationAsReturned(disp.id, 2);

    // 3. Verify
    const updated = (pharmacyService as any).dispensations.find((d: any) => d.id === disp.id);
    console.log('Updated Dispensation:', updated);

    if (updated.returnedQuantity !== 2) {
        console.error('FAILED: returnedQuantity mismatch', updated.returnedQuantity);
        process.exit(1);
    }

    if (updated.status === 'RETURNED') {
        console.error('FAILED: Incorrect status for partial return');
        process.exit(1);
    }

    // 4. Mark remainder returned
    console.log('Returning 3 units...');
    pharmacyService.markDispensationAsReturned(disp.id, 3);
    const final = (pharmacyService as any).dispensations.find((d: any) => d.id === disp.id);
    console.log('Final Dispensation:', final);

    if (final.status !== 'RETURNED') {
        console.error('FAILED: Status not updated to RETURNED');
        process.exit(1);
    }

    console.log('SUCCESS');
};

run();
