"use strict";
/**
 * PostgreSQL Global Database Connection Pool
 *
 * Provides a shared connection pool to the sahty_global database.
 * Used for accessing global reference data (products, actes, suppliers, etc.)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGlobalPool = getGlobalPool;
exports.globalQuery = globalQuery;
exports.globalQueryOne = globalQueryOne;
exports.getGlobalClient = getGlobalClient;
exports.globalTransaction = globalTransaction;
exports.closeGlobalPool = closeGlobalPool;
var pg_1 = require("pg");
// Configuration from environment
var config = {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    user: process.env.PG_USER || 'sahty',
    password: process.env.PG_PASSWORD || 'sahty_dev_2026',
    database: process.env.PG_GLOBAL_DB || 'sahty_global',
    max: parseInt(process.env.PG_POOL_MAX || '20'),
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.PG_POOL_CONNECTION_TIMEOUT || '5000'),
};
// Singleton pool instance
var pool = null;
/**
 * Get the global database pool (creates if not exists)
 */
function getGlobalPool() {
    if (!pool) {
        pool = new pg_1.Pool(config);
        // Log connection errors
        pool.on('error', function (err) {
            console.error('Global pool error:', err.message);
        });
        console.log("[GlobalPg] Pool created for ".concat(config.database));
    }
    return pool;
}
/**
 * Execute a query on the global database
 */
function globalQuery(sql_1) {
    return __awaiter(this, arguments, void 0, function (sql, params) {
        var result;
        if (params === void 0) { params = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getGlobalPool().query(sql, params)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows];
            }
        });
    });
}
/**
 * Execute a query and return single row (or null)
 */
function globalQueryOne(sql_1) {
    return __awaiter(this, arguments, void 0, function (sql, params) {
        var result;
        if (params === void 0) { params = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getGlobalPool().query(sql, params)];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.rows[0] || null];
            }
        });
    });
}
/**
 * Get a client for transaction support
 */
function getGlobalClient() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getGlobalPool().connect()];
        });
    });
}
function globalTransaction(fn, auditContext) {
    return __awaiter(this, void 0, void 0, function () {
        var client, result, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getGlobalClient()];
                case 1:
                    client = _a.sent();
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 9, 11, 12]);
                    return [4 /*yield*/, client.query('BEGIN')];
                case 3:
                    _a.sent();
                    if (!auditContext) return [3 /*break*/, 6];
                    return [4 /*yield*/, client.query("SELECT set_config('sahty.current_user_id', $1, true)", [auditContext.userId])];
                case 4:
                    _a.sent();
                    if (!auditContext.clientInfo) return [3 /*break*/, 6];
                    return [4 /*yield*/, client.query("SELECT set_config('sahty.client_info', $1, true)", [auditContext.clientInfo])];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6: return [4 /*yield*/, fn(client)];
                case 7:
                    result = _a.sent();
                    return [4 /*yield*/, client.query('COMMIT')];
                case 8:
                    _a.sent();
                    return [2 /*return*/, result];
                case 9:
                    err_1 = _a.sent();
                    return [4 /*yield*/, client.query('ROLLBACK')];
                case 10:
                    _a.sent();
                    throw err_1;
                case 11:
                    client.release();
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    });
}
/**
 * Close the global pool (for graceful shutdown)
 */
function closeGlobalPool() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!pool) return [3 /*break*/, 2];
                    return [4 /*yield*/, pool.end()];
                case 1:
                    _a.sent();
                    pool = null;
                    console.log('[GlobalPg] Pool closed');
                    _a.label = 2;
                case 2: return [2 /*return*/];
            }
        });
    });
}
