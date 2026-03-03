import urllib.request
import json
import datetime

def main():
    try:
        # Login
        req = urllib.request.Request("http://localhost:3001/api/auth/login", data=json.dumps({"username":"medt", "password":"password123"}).encode('utf-8'), headers={"Content-Type": "application/json"})
        try:
            res = urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            if e.code == 401:
                req = urllib.request.Request("http://localhost:3001/api/auth/login", data=json.dumps({"username":"medt", "password":"medt"}).encode('utf-8'), headers={"Content-Type": "application/json"})
                res = urllib.request.urlopen(req)
            else: raise e
            
        data = json.loads(res.read())
        token = data.get("token")
        print("Logged in")

        # Get Timeline
        req2 = urllib.request.Request("http://localhost:3001/api/emr/patients/2a96aac3-9cdb-4912-bb55-2bb3fec17805/surveillance/timeline?from=2026-02-27T08:00:00.000Z&to=2026-03-02T08:00:00.000Z", headers={"Authorization": f"Bearer {token}"})
        res2 = urllib.request.urlopen(req2)
        timeline = json.loads(res2.read())
        
        eventId = None
        for ev in timeline.get("timelineEvents", []):
            if ev.get("prescriptionId") == "8a83b7ed-401f-46c3-a3ca-a98cc36ddd84":
                eventId = ev.get("eventId")
                break
                
        if not eventId:
            print("Event not found!")
            return
            
        print(f"Found event: {eventId}")
        
        payload = {
            "prescriptionId": "8a83b7ed-401f-46c3-a3ca-a98cc36ddd84",
            "eventId": eventId,
            "patientId": "2a96aac3-9cdb-4912-bb55-2bb3fec17805",
            "action_type": "started",
            "occurred_at": "2026-02-28T19:42:00.000Z",
            "actual_start_at": "2026-02-28T19:42:00.000Z",
            "actual_end_at": None,
            "planned_date": "2026-02-28T19:42:00.000Z",
            "justification": None
        }
        
        req3 = urllib.request.Request("http://localhost:3001/api/prescriptions/8a83b7ed-401f-46c3-a3ca-a98cc36ddd84/execute", data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
        try:
            res3 = urllib.request.urlopen(req3)
            print("EXEC STATUS:", res3.status)
            print("EXEC BODY:", res3.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            print("EXEC FAILED STATUS:", e.code)
            print("EXEC FAILED BODY:", e.read().decode('utf-8'))
            
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    main()
