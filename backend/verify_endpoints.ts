
import axios from 'axios';
import jwt from 'jsonwebtoken';

const BASE_URL = 'http://localhost:3001/api';
const JWT_SECRET = 'super-secret-key-change-in-prod'; 

// 1. Pharma2 (Demo)
const userDemo = {
    id: "user_1767371467189",
    username: "pharma2",
    user_type: "TENANT_USER",
    role_id: "role_pharmacien",
    client_id: "client_demo"
};

// 2. Pharma1 (UMAN)
const userUMAN = {
    id: "user_1767295352127",
    username: "pharma1",
    user_type: "TENANT_USER",
    role_id: "role_pharmacien",
    client_id: "client_1767102086031"
};

const tokenDemo = jwt.sign(userDemo, JWT_SECRET, { expiresIn: '1h' });
const tokenUMAN = jwt.sign(userUMAN, JWT_SECRET, { expiresIn: '1h' });

async function verify() {
    console.log("🔒 Starting Product Isolation Verification...\n");
    const testProductId = `PROD-TEST-${Date.now()}`;

    // --- STEP 1: Create Product as Demo Client ---
    console.log("--- Step 1: Client Demo (pharma2) creates a product ---");
    try {
        await axios.post(`${BASE_URL}/pharmacy/products`, {
            id: testProductId,
            name: "Secret Demo Product",
            type: "Médicament",
            suppliers: [],
            profitMargin: 20,
            vatRate: 5.5,
            isSubdivisable: false,
            unitsPerPack: 10,
            createdAt: new Date(),
            updatedAt: new Date()
        }, { headers: { Authorization: `Bearer ${tokenDemo}` } });
        console.log(`✅ Product Created: ${testProductId}`);
    } catch (e: any) {
        console.error(`❌ Creation Failed: ${e.response?.data?.message || e.message}`);
        return;
    }

    // --- STEP 2: Verify Visibility for Demo Client ---
    console.log("\n--- Step 2: Client Demo checks catalog ---");
    try {
        const res = await axios.get(`${BASE_URL}/pharmacy/catalog`, { headers: { Authorization: `Bearer ${tokenDemo}` } });
        const found = res.data.find((p: any) => p.id === testProductId);
        if (found) console.log(`✅ Success: Product is visible to creator.`);
        else console.error(`❌ Failure: Product NOT found for creator!`);
    } catch (e: any) {
        console.error(`❌ Fetch Failed: ${e.message}`);
    }

    // --- STEP 3: Verify INVISIBILITY for UMAN Client ---
    console.log("\n--- Step 3: Client UMAN (pharma1) checks catalog ---");
    try {
        const res = await axios.get(`${BASE_URL}/pharmacy/catalog`, { headers: { Authorization: `Bearer ${tokenUMAN}` } });
        const found = res.data.find((p: any) => p.id === testProductId);
        if (found) console.error(`❌ SECURITY FAILURE: UMAN client can see Demo product!`);
        else console.log(`✅ Success: Product is HIDDEN from UMAN client.`);
        
        console.log(`\n(UMAN Catalog Size: ${res.data.length} items)`);
    } catch (e: any) {
        console.error(`❌ Fetch Failed: ${e.message}`);
    }
}

verify();
