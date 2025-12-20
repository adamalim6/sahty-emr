
import * as http from 'http';

const BASE_URL = 'http://localhost:3001/api';

const endpoints = [
    '/pharmacy/inventory',
    '/pharmacy/catalog',
    '/pharmacy/locations',
    '/pharmacy/partners',
    '/pharmacy/stock-out-history',
    '/pharmacy/orders',
    '/pharmacy/deliveries',
    '/pharmacy/suppliers'
];

function fetch(url: string): Promise<{ status: number, statusText: string, data: any }> {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode || 0, statusText: res.statusMessage || '', data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode || 0, statusText: res.statusMessage || '', data: data });
                }
            });
        }).on('error', (err) => reject(err));
    });
}

async function checkEndpoints() {
    console.log('Checking endpoints...');
    for (const endpoint of endpoints) {
        try {
            const res = await fetch(`${BASE_URL}${endpoint}`);
            if (res.status >= 200 && res.status < 300) {
                console.log(`✅ ${endpoint} - ${res.status}`);
                console.log(`   Items: ${Array.isArray(res.data) ? res.data.length : 'Object'}`);
            } else {
                console.error(`❌ ${endpoint} - ${res.status} ${res.statusText}`);
                console.error('   Error:', res.data);
            }
        } catch (error: any) {
            console.error(`❌ ${endpoint} - FAILED`, error.message);
        }
    }
}

checkEndpoints();
