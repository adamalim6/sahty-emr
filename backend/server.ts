
// Server restart trigger 9
import express from 'express';
// Force Restart 1
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
import { authenticateToken } from './middleware/authMiddleware';
import { requireModule } from './middleware/moduleMiddleware';const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes); // SuperAdmin auth handled internally

// Protected Tenant Routes
app.use('/api/settings', authenticateToken, requireModule('SETTINGS'), settingsRoutes);
app.use('/api/actes', authenticateToken, actesRoutes); // Should this be protected? Assuming yes.
app.use('/api/dev', devRoutes); // Dev routes (maybe protect in prod?)
app.use('/api/global/products', globalProductRoutes);
app.use('/api/global/dci', globalDCIRoutes);
app.use('/api/global/atc', authenticateToken, globalATCRoutes);
app.use('/api/global/emdn', authenticateToken, globalEMDNRoutes);

app.use('/api/emr', authenticateToken, requireModule('EMR'), emrRoutes);
app.use('/api/pharmacy', authenticateToken, requireModule('PHARMACY'), pharmacyRoutes);
app.use('/api/pharmacy', authenticateToken, requireModule('PHARMACY'), serializedPackRoutes);
app.use('/api/pharmacy', authenticateToken, requireModule('PHARMACY'), dispensationRoutes);
app.use('/api/prescriptions', authenticateToken, requireModule('PHARMACY'), prescriptionRoutes); 
app.use('/api', authenticateToken, dispensationRoutes); // Backup route? likely legacy or specific generic

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
