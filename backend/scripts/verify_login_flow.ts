
import { getGlobalDB } from '../db/globalDb';
import bcrypt from 'bcryptjs';

const API_URL = 'http://127.0.0.1:3001/api';

async function verifyLogin() {
    console.log("1. Creating Test User in Global DB...");
    const db = await getGlobalDB();
    
    const username = `test_admin_${Date.now()}`;
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}`;

    try {
        await new Promise<void>((resolve, reject) => {
            db.run(`
                INSERT INTO users (id, username, password_hash, nom, prenom, user_type, role_code, active, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                userId, 
                username, 
                hashedPassword, 
                'Test', 
                'Admin', 
                'SUPER_ADMIN', 
                'SUPER_ADMIN', 
                1, 
                new Date().toISOString()
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        console.log(`   User created: ${username} / ${password}`);
    } catch (e: any) {
        console.error("   Failed to create user:", e.message);
        process.exit(1);
    }

    console.log("\n2. Attempting Login via API...");
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        console.log("   Login Status:", response.status);
        const data = await response.json();
        console.log("   Login Data:", data);

        if (response.ok && data.token) {
            console.log("\n✅ SUCCESS: Login verified against SQLite!");
            
            // Verify /me endpoint
            console.log("\n3. Verifying /me endpoint...");
            const meResponse = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${data.token}` }
            });
            const meData = await meResponse.json();
            console.log("   Me Data:", meData);
            
            if (meData.username === username) {
                 console.log("✅ SUCCESS: /me verified!");
            } else {
                 console.error("❌ FAILURE: /me returned wrong user");
            }

        } else {
            console.error("❌ FAILURE: Login failed or no token returned");
        }

    } catch (e: any) {
        console.error("❌ FAILURE: API Call failed", e.message);
    }
}

verifyLogin().catch(console.error);
