
// Server restart trigger 10
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
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
import escarresRoutes from './routes/escarresRoutes';
import observationsRoutes from './routes/observationsRoutes';
import addictionsRoutes from './routes/addictionsRoutes';
import patientDocumentRoutes from './routes/patientDocumentRoutes';
import administrationRoutes from './routes/administrationRoutes';
import labDocumentLinkRoutes from './routes/labDocumentLinkRoutes';
import patientLabReportRoutes from './routes/patientLabReportRoutes';
import labReferenceRoutes from './routes/labReferenceRoutes';
import smartPhrasesRoutes from './routes/smartPhrasesRoutes';
import smartValuesRoutes from './routes/smartValuesRoutes';
import clinicalExamsRoutes from './routes/clinicalExamsRoutes';
import limsRoutes from './routes/limsRoutes';
import limsExecutionRoutes from './routes/limsExecutionRoutes';
import { authenticateToken, authenticateAnyToken } from './middleware/authMiddleware';
import { requireModule } from './middleware/moduleMiddleware';
import { startIdentitySyncWorker } from './workers/identitySyncWorker';
import { identitySyncService } from './services/identitySyncService';
import { startAuthSyncWorker } from './workers/authSyncWorker';
import { authSyncService } from './services/authSyncService';
import { globalQuery } from './db/globalPg';
import referenceRoutes from './routes/referenceRoutes';
import { authenticateGlobalAdmin } from './middleware/globalAuthMiddleware';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://localhost:3002', 'http://127.0.0.1:3002', 'http://localhost:4173', 'http://127.0.0.1:4173', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'API-Version', 'Accept-Language']
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes); // SuperAdmin auth handled internally

// Protected Tenant Routes
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/actes', authenticateAnyToken, actesRoutes);
app.use('/api/dev', devRoutes);
app.use('/api/global/products', globalProductRoutes);
app.use('/api/global/dci', globalDCIRoutes);
app.use('/api/global/atc', authenticateGlobalAdmin, globalATCRoutes);
app.use('/api/global/emdn', authenticateGlobalAdmin, globalEMDNRoutes);

// WHO ICD-11 Local Proxy (No Auth required for raw search engine queries)
app.use('/api/icd', createProxyMiddleware({
    target: 'http://localhost:8090',
    changeOrigin: true,
    pathRewrite: {
        '^/api/icd': '', // Strip /api/icd when forwarding to docker container root
    }
}));

// Catalog Reference Endpoints (Tenant safe)
app.use('/api/reference', referenceRoutes);
app.use('/api/reference/atc', authenticateToken, globalATCRoutes);
app.use('/api/reference/emdn', authenticateToken, globalEMDNRoutes);

import allergiesRoutes from './routes/allergiesRoutes';

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/emr', authenticateToken, requireModule('EMR'), emrRoutes);
app.use('/api/pharmacy', authenticateToken, requireModule('PHARMACY'), pharmacyRoutes);
app.use('/api/pharmacy', authenticateToken, requireModule('PHARMACY'), serializedPackRoutes);
app.use('/api/pharmacy', authenticateToken, requireModule('PHARMACY'), dispensationRoutes);
app.use('/api/prescriptions', authenticateToken, prescriptionRoutes);
app.use('/api/stock-transfers', authenticateToken, stockTransferRoutes);
app.use('/api/stock-reservations', authenticateToken, stockReservationRoutes);
app.use('/api', authenticateToken, dispensationRoutes);
app.use('/api/escarres', authenticateToken, escarresRoutes);
app.use('/api/allergies', authenticateToken, allergiesRoutes);
app.use('/api/observations', authenticateToken, observationsRoutes);
app.use('/api/addictions', authenticateToken, addictionsRoutes);
app.use('/api/documents', authenticateToken, patientDocumentRoutes);
app.use('/api/administration', authenticateToken, administrationRoutes);
app.use('/api/lab-reports', authenticateToken, labDocumentLinkRoutes);
app.use('/api/patient-lab-reports', authenticateToken, patientLabReportRoutes);
app.use('/api/reference', authenticateToken, labReferenceRoutes);
app.use('/api/smart-phrases', authenticateToken, smartPhrasesRoutes);
app.use('/api/smart-values', authenticateToken, smartValuesRoutes);
app.use('/api/patients/:patientId/clinical-exams', authenticateToken, clinicalExamsRoutes);
app.use('/api/lims', authenticateToken, limsRoutes);
app.use('/api/lims/execution', authenticateToken, limsExecutionRoutes);

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
    // startIdentitySyncWorker();
    // startAuthSyncWorker();
});
// Trigger nodemon reload Sun Mar  8 01:17:19 +00 2026
