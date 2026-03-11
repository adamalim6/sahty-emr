async function run() {
    console.log("Mocking UI API call for APPORTS_HYD_CR_MAN...");
    
    // We'll simulate exactly what FicheSurveillance.tsx does
    const patientId = '2a96aac3-9cdb-4912-bb55-2bb3fec17805'; // Hasan Fahmy Yosra from the screenshot
    const parameterId = '995df62d-4083-4f19-8136-6d0a730b181b';
    const parameterCode = 'APPORTS_HYD_CR_MAN';
    const recordedAt = new Date().toISOString();
    
    try {
        // We know the dev server listens on 3001 typically, based on the UI proxying from 3000 to 3001 or directly.
        // Looking at the screenshot, the API is 3001/api/emr/patient...
        const res = await fetch(`http://localhost:3001/api/emr/patient/${patientId}/surveillance/cell`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Assuming standard dev auth headers if any, or it might fail auth. 
                // Wait, if it needs auth, we might get 401. Let's send a fake user or check how it's handled.
                'x-tenant-id': 'ced91ced-fe46-45d1-8ead-b5d51bad5895',
                'Authorization': 'Bearer ' + 'dev_token_maybe' // Will see if auth fails
            },
            body: JSON.stringify({
                recordedAt,
                parameterId,
                parameterCode,
                value: 500,
                admissionId: null
            })
        });

        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text}`);
    } catch (e: any) {
        console.error("Fetch failed:", e.message);
    }
}
run();
