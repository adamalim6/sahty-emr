
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3001/api';
const JWT_SECRET = 'super-secret-key-change-in-prod'; 

// 2. Pharma1 (UMAN)
const userUMAN = {
    id: "user_1767295352127",
    username: "pharma1",
    user_type: "TENANT_USER",
    role_id: "role_pharmacien",
    client_id: "client_1767102086031"
};

const tokenUMAN = jwt.sign(userUMAN, JWT_SECRET, { expiresIn: '1h' });

// 3. Client 2 (pharma2) - for Isolation Test
const user2 = {
    id: "user_other_client",
    username: "pharma2",
    user_type: "TENANT_USER",
    role_id: "role_pharmacien",
    client_id: "client_OTHER_123"
};
const tokenUser2 = jwt.sign(user2, JWT_SECRET, { expiresIn: '1h' });

async function verify() {
    console.log("🔒 Starting UMAN (pharma1) Product Persistence Verification...\n");
    const testProductId = `PROD-UMAN-${Date.now()}`;

    // --- STEP 1: Create Product as UMAN Client ---
    console.log("--- Step 1: Client UMAN (pharma1) creates a product ---");
    try {
        const res = await fetch(`${BASE_URL}/pharmacy/catalog`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${tokenUMAN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: testProductId,
                name: "UMAN Test Product",
                type: "Médicament",
                suppliers: [],
                profitMargin: 20,
                vatRate: 5.5,
                isSubdivisable: false,
                unitsPerPack: 10,
                createdAt: new Date(),
                updatedAt: new Date()
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.message || res.statusText);
        }
        const data = await res.json();
        console.log(`✅ Product Created: ${data.id} (Tenant: ${data.tenantId})`);
    } catch (e) {
        console.error(`❌ Creation Failed: ${e.message}`);
        return;
    }

    // --- STEP 2: Verify Visibility for UMAN Client ---
    console.log("\n--- Step 2: Client UMAN checks catalog ---");
    try {
        const res = await fetch(`${BASE_URL}/pharmacy/catalog`, {
            headers: { 'Authorization': `Bearer ${tokenUMAN}` }
        });
        const data = await res.json();
        console.log(`📦 Catalog Size: ${data.length}`);
        const found = data.find(p => p.id === testProductId);
        if (found) console.log(`✅ Success: Product is PERSISTED and VISIBLE to creator.`);
        else {
            console.error(`❌ Failure: Product NOT found for creator!`);
        }
    } catch (e) {
        console.error(`❌ Fetch Failed: ${e.message}`);
    }

    // --- STEP 3: Verify /auth/me (Session Persistence) ---
    console.log("\n--- Step 3: Verify Session Persistence (/auth/me) ---");
    try {
        const res = await fetch(`${BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${tokenUMAN}` }
        });
        
        if (res.ok) {
            const user = await res.json();
            console.log(`✅ Auth Check Passed. User: ${user.username}, Tenant: ${user.client_id}`);
        } else {
            console.error(`❌ Auth Check FAILED using same token! Status: ${res.status} ${res.statusText}`);
        }
    } catch (e) {
        console.error(`❌ Auth Network Error: ${e.message}`);
    }

    // --- STEP 4: Verify Stock Entry Isolation (Purchase Orders) ---
    console.log("\n--- Step 4: Verify Stock Entry Isolation (Purchase Orders) ---");
    
    // 4a. Create PO as UMAN
    let createdPOId = null;
    try {
        const poData = {
            supplierId: 'SUP-001', // Assuming this exists or is global
            supplierName: 'Test Supplier',
            date: new Date(),
            status: 'Brouillon',
            items: []
        };
        const createRes = await fetch(`${BASE_URL}/pharmacy/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUMAN}` },
            body: JSON.stringify(poData)
        });
        if (!createRes.ok) throw new Error(`Create failed: ${createRes.status} ${createRes.statusText}`);
        const createdPO = await createRes.json();
        createdPOId = createdPO.id;
        console.log(`✅ UMAN Created PO: ${createdPO.id} (Tenant: ${createdPO.tenantId})`);

        // 4b. Check UMAN sees it
        const listRes = await fetch(`${BASE_URL}/pharmacy/orders`, {
            headers: { 'Authorization': `Bearer ${tokenUMAN}` }
        });
        const umanPOs = await listRes.json();
        const foundUman = umanPOs.find(p => p.id === createdPOId);
        if (foundUman) console.log(`✅ UMAN sees their PO.`);
        else console.error(`❌ UMAN CANNOT see their PO!`);

        // 4c. Check OTHER CLIENT (pharma2) does NOT see it
        const listResOther = await fetch(`${BASE_URL}/pharmacy/orders`, {
            headers: { 'Authorization': `Bearer ${tokenUser2}` }
        });
        const otherPOs = await listResOther.json();
        const foundOther = otherPOs.find(p => p.id === createdPOId);
        
        if (!foundOther) {
             console.log(`✅ SUCCESS: Client 2 CANNOT see UMAN's PO.`);
        } else {
             console.error(`❌ FAILURE: Client 2 CAN SEE UMAN's PO! Leak detected.`);
        }


    } catch (e) {
        console.error(`❌ PO Test Error: ${e.message}`);
    }

    // --- STEP 5: Verify Delivery Note Isolation (Quarantine Source) ---
    console.log("\n--- Step 5: Verify Delivery Note Isolation ---");
    
    if (createdPOId) {
        try {
            // 5a. Create Delivery Note as UMAN
            const dnData = {
                poId: createdPOId,
                date: new Date(),
                createdBy: 'pharma1',
                grnReference: `GRN-${Date.now()}`,
                status: 'En attente',
                items: [] // Empty items for test
            };
            
            const createRes = await fetch(`${BASE_URL}/pharmacy/deliveries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUMAN}` },
                body: JSON.stringify(dnData)
            });
            
            if (!createRes.ok) throw new Error(`Create DN failed: ${createRes.status} ${createRes.statusText}`);
            const createdDN = await createRes.json();
            console.log(`✅ UMAN Created DN: ${createdDN.id} (Tenant: ${createdDN.tenantId})`);

            // 5b. Check UMAN sees it
            const listRes = await fetch(`${BASE_URL}/pharmacy/deliveries`, {
                headers: { 'Authorization': `Bearer ${tokenUMAN}` }
            });
            const umanDNs = await listRes.json();
            const foundUman = umanDNs.find(n => n.id === createdDN.id);
            if (foundUman) console.log(`✅ UMAN sees their DN.`);
            else console.error(`❌ UMAN CANNOT see their DN!`);

            // 5c. Check OTHER CLIENT (pharma2) does NOT see it
            const listResOther = await fetch(`${BASE_URL}/pharmacy/deliveries`, {
                headers: { 'Authorization': `Bearer ${tokenUser2}` }
            });
            const otherDNs = await listResOther.json();
            const foundOther = otherDNs.find(n => n.id === createdDN.id);
            
            if (!foundOther) {
                 console.log(`✅ SUCCESS: Client 2 CANNOT see UMAN's Delivery Note.`);
            } else {
                 console.error(`❌ FAILURE: Client 2 CAN SEE UMAN's Delivery Note! Leak detected.`);
            }

        } catch (e) {
            console.error(`❌ DN Test Error: ${e.message}`);
        }
    } else {
        console.warn("⚠️ Skipping DN test because PO creation failed earlier.");
    }
    console.log("\n--- Step 6: Verify Locations Isolation ---");
    try {
        const locId = `LOC-UMAN-${Date.now()}`;
        const locData = { id: locId, name: `Rayon A (${locId})`, isActive: true };
        
        // 6a. Create Location as UMAN
        const createLocRes = await fetch(`${BASE_URL}/pharmacy/locations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenUMAN}` },
            body: JSON.stringify(locData)
        });
        if (createLocRes.ok) {
            console.log(`✅ UMAN Created Location: ${locId}`);
        } else {
             console.error(`❌ Create Location Failed: ${createLocRes.statusText}`);
        }

        // 6b. Check UMAN sees it
        const listLocRes = await fetch(`${BASE_URL}/pharmacy/locations`, {
            headers: { 'Authorization': `Bearer ${tokenUMAN}` }
        });
        const umanLocs = await listLocRes.json();
        if (umanLocs.find(l => l.id === locId)) console.log("✅ UMAN sees their Location.");
        else console.error("❌ UMAN cannot see their Location!");

        // 6c. Check OTHER CLIENT cannot see it
        const listLocOther = await fetch(`${BASE_URL}/pharmacy/locations`, {
            headers: { 'Authorization': `Bearer ${tokenUser2}` }
        });
        const otherLocs = await listLocOther.json();
        if (!otherLocs.find(l => l.id === locId)) console.log("✅ SUCCESS: Client 2 CANNOT see UMAN's Location.");
        else console.error("❌ FAILURE: Client 2 CAN SEE UMAN's Location!");

    } catch (e) { console.error(e); }

    // --- STEP 7: Verify Stock Pharma Isolation (Basic) ---
    console.log("\n--- Step 7: Verify Stock Pharma Isolation (Basic) ---");
    const stockRes = await fetch(`${BASE_URL}/pharmacy/inventory`, { headers: { 'Authorization': `Bearer ${tokenUser2}` } });
    const stockItems = await stockRes.json();
    if (stockItems.length === 0) console.log("✅ SUCCESS: Client 2 sees 0 stock items (Clean state for them).");
    else console.log(`ℹ️ Client 2 sees ${stockItems.length} items. (Ensure these are their own or none)`);

}

verify();
