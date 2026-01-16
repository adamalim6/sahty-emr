
import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.get('/tree', (req, res) => {
    const treePath = path.join(__dirname, '../data/global/emdn_tree.json');
    if (fs.existsSync(treePath)) {
        res.setHeader('Content-Type', 'application/json');
        fs.createReadStream(treePath).pipe(res);
    } else {
        res.status(404).json({ error: 'EMDN Tree not found. Please run the parser script.' });
    }
});

export default router;
