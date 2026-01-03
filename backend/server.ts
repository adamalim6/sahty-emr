
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

const app = express();
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
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/actes', actesRoutes);

app.use('/api/emr', emrRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/pharmacy', serializedPackRoutes);
app.use('/api/pharmacy', dispensationRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api', dispensationRoutes); // For /api/prescriptions/:id/dispensations

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
