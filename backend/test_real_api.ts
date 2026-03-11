async function execute() {
    console.log("1. Logging in via real API to get session token...");
    let token;
    try {
        const httpRes = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'medt', password: 'password' })
        });
        const data = await httpRes.json();
        token = data.token;
        if (!httpRes.ok) throw new Error(data.error);
    } catch (e: any) {
        console.log("Login with password failed, trying 'medt' as password...", e?.message);
        try {
            const httpRes = await fetch('http://localhost:3001/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'medt', password: 'medt' })
            });
            const data = await httpRes.json();
            token = data.token;
            if (!httpRes.ok) throw new Error(data.error);
        } catch (e2: any) {
            console.log("Both failed", e2.message);
            return process.exit(1);
        }
    }
    
    console.log("Token acquired:", token.substring(0, 20) + "...");
    const payloadStr = Buffer.from(token.split('.')[1], 'base64').toString();
    console.log("Raw payload from token:", payloadStr);
    
    const role = JSON.parse(payloadStr).role;
    console.log("Extracted Role:", role);

    console.log("2. Hitting the API to create observation...");
    try {
        const res = await fetch('http://localhost:3001/api/observations', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                tenant_patient_id: 'e3bc09ea-8b61-4eea-858d-35e8949fe150', note_type: 'GENERAL',
                privacy_level: 'NORMAL',
                declared_time: new Date().toISOString(),
                status: 'DRAFT',
                body_html: '<p>test real api role check</p>'
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        console.log("Saved Obs author role:", data.author_role);
    } catch(e: any) {
        console.error("API error:", e.message);
    }
    process.exit(0);
}

execute();
