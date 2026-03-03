import axios from 'axios';

async function test() {
  try {
    const loginRes = await axios.post("http://localhost:3001/api/auth/login", {
      username: "medt", password: "medt"
    });
    const token = loginRes.data.token;

    const eventsRes = await axios.get("http://localhost:3001/api/emr/patients/2a96aac3-9cdb-4912-bb55-2bb3fec17805/surveillance/timeline?from=2026-02-27T08:00:00.000Z&to=2026-03-02T08:00:00.000Z", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    // Find event 8a83b7ed...
    const event = eventsRes.data.timelineEvents.find(e => e.prescription_id === "8a83b7ed-401f-46c3-a3ca-a98cc36ddd84");
    if (!event) return console.log("Event not found");

    console.log("Found event:", event.event_id);

    try {
        const execRes = await axios.post(`http://localhost:3001/api/prescriptions/8a83b7ed-401f-46c3-a3ca-a98cc36ddd84/execute`, {
          action_type: "completed",
          eventId: event.event_id,
          occurred_at: new Date().toISOString()
        }, {
           headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
        });
        console.log("EXEC HTTP STATUS:", execRes.status);
        console.log("EXEC BODY:", execRes.data);
    } catch (e) {
        console.log("EXEC API ERROR STATUS:", e.response?.status);
        console.log("EXEC API ERROR BODY:", e.response?.data);
    }
  } catch(e) { console.error("Global error", e.message); }
}

test();
