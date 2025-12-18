
import express from 'express';
import cors from 'cors';
import emrRoutes from './routes/emrRoutes';
import pharmacyRoutes from './routes/pharmacyRoutes';
import prescriptionRoutes from './routes/prescriptionRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/emr', emrRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/prescriptions', prescriptionRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
