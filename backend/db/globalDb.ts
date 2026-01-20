
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const GLOBAL_DB_PATH = path.join(__dirname, '../data/global/global.db');
const SCHEMA_PATH = path.join(__dirname, 'global_schema.sql');

let globalDb: sqlite3.Database | null = null;

export const getGlobalDB = (): Promise<sqlite3.Database> => {
    return new Promise((resolve, reject) => {
        if (globalDb) return resolve(globalDb);

        const dbDir = path.dirname(GLOBAL_DB_PATH);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        const db = new sqlite3.Database(GLOBAL_DB_PATH, (err) => {
            if (err) return reject(err);

            db.run('PRAGMA foreign_keys = ON', (err) => {
                if (err) return reject(err);

                // Init Schema if needed
                if (fs.existsSync(SCHEMA_PATH)) {
                    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
                    db.exec(schema, (err) => {
                        if (err) return reject(err);
                        globalDb = db;
                        resolve(db);
                    });
                } else {
                    globalDb = db;
                    resolve(db);
                }
            });
        });
    });
};
