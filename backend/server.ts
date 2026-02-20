
// Server restart trigger 10
import express from 'express';
import cors from 'cors';
import emrRoutes from './routes/emrRoutes';
import pharmacyRoutes from './routes/pharmacyRoutes';
import prescriptionRoutes from './routes/prescriptionRoutes';
import serializedPackRoutes from './routes/serializedPackRoutes';
import dispensationRoutes from './routes/dispensationRoutes';
import authRoutes from './routes/authRoutes';
import superAdminRoutes from './routes/superAdminRoutes';
import settingsRoutes from './routes/settingsRoutes';
import actesRoutes from './routes/actesRoutes';
import globalProductRoutes from './routes/globalProductRoutes';
import globalDCIRoutes from './routes/globalDCIRoutes';
import globalATCRoutes from './routes/globalATCRoutes';
import globalEMDNRoutes from './routes/globalEMDNRoutes';
import devRoutes from './routes/devRoutes';
import stockTransferRoutes from './routes/stockTransferRoutes';
import stockReservationRoutes from './routes/stockReservationRoutes';
import { authenticateToken } from './middleware/authMiddleware';
import { requireModule } from './middleware/moduleMiddleware';
import { startIdentitySyncWorker } from './workers/identitySyncWorker';
import { identitySyncService } from './services/identitySyncService';
import { startAuthSyncWorker } from './workers/authSyncWorker';
import { authSyncService } from './services/authSyncService';
import { globalQuery } from './db/globalPg';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes); // SuperAdmin auth handled internally

// Protected Tenant Routes
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/actes', authenticateToken, actesRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/global/products', globalProductRoutes);
app.use('/api/global/dci', globalDCIRoutes);
app.use('/api/global/atc', authenticateToken, globalATCRoutes);
app.use('/api/global/emdn', authenticateToken, globalEMDNRoutes);

app.use('/api/emr', authenticateToken, requireModule('EMR'), emrRoutes);
app.use('/api/pharmacy', authenticateToken, requireModule('PHARMACY'), pharmacyRoutes);
app.use('/api/pharmacy', authenticateToken, requireModule('PHARMACY'), serializedPackRoutes);
app.use('/api/pharmacy', authenticateToken, requireModule('PHARMACY'), dispensationRoutes);
// app.use('/api/pharmacy/stock-reservations', authenticateToken, requireModule('PHARMACY'), stockReservationRoutes); // MOVED below
app.use('/api/prescriptions', authenticateToken, prescriptionRoutes); 
app.use('/api/stock-transfers', authenticateToken, stockTransferRoutes); 
app.use('/api/stock-reservations', authenticateToken, stockReservationRoutes); // Shared API
app.use('/api', authenticateToken, dispensationRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Identity Sync diagnostics
app.get('/api/dev/sync-status', async (req, res) => {
    try {
        const status = await identitySyncService.getStatus();
        res.json(status);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Auth Sync diagnostics
app.get('/api/dev/auth-sync-status', async (req, res) => {
    try {
        // Find all groups with auth_sync
        const groups = await globalQuery(`SELECT db_name FROM groups WHERE db_name IS NOT NULL`);
        const statuses = [];
        for (const g of groups) {
            try {
                const status = await authSyncService.getStatus(g.db_name);
                statuses.push(status);
            } catch (err: any) {
                statuses.push({ groupDbName: g.db_name, error: err.message });
            }
        }
        res.json(statuses);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startIdentitySyncWorker();
    startAuthSyncWorker();
});
