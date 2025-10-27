const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.connected = false;
        this.db = null;
        this.dbPath = path.join(__dirname, 'monsnode.db');
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                console.log('Connecting to SQLite database...');
                
                this.db = new sqlite3.Database(this.dbPath, (err) => {
                    if (err) {
                        console.error('Database connection error:', err);
                        reject(err);
                        return;
                    }
                    
                    console.log('✅ Connected to SQLite database');
                    this.connected = true;
                    
                    // Create tables
                    this.createTables()
                        .then(() => resolve(true))
                        .catch(reject);
                });
            } catch (error) {
                console.error('Database connection error:', error);
                reject(error);
            }
        });
    }

    async createTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT,
                lastName TEXT,
                joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                saldoAwal REAL DEFAULT 0,
                saldo REAL DEFAULT 0,
                sisaSaldo REAL DEFAULT 0,
                isActive INTEGER DEFAULT 1
            )`,
            `CREATE TABLE IF NOT EXISTS downloads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                url TEXT,
                filename TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending',
                FOREIGN KEY (userId) REFERENCES users(id)
            )`,
            `CREATE TABLE IF NOT EXISTS searches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                userId TEXT,
                query TEXT,
                results TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (userId) REFERENCES users(id)
            )`
        ];

        for (const sql of tables) {
            await this.run(sql);
        }
        
        console.log('✅ Database tables created/verified');
    }

    async disconnect() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            this.db.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.connected = false;
                console.log('Database disconnected');
                resolve();
            });
        });
    }

    // Helper methods for database operations
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows);
            });
        });
    }

    // User operations
    async addUser(userId, username, lastName = '', saldoAwal = 0) {
        try {
            // Check if user already exists
            const existing = await this.getUser(userId);
            if (existing) {
                return existing;
            }

            const sql = `INSERT INTO users (id, username, lastName, saldoAwal, saldo, sisaSaldo) 
                         VALUES (?, ?, ?, ?, ?, ?)`;
            await this.run(sql, [userId, username, lastName, saldoAwal, saldoAwal, saldoAwal]);
            
            return await this.getUser(userId);
        } catch (error) {
            console.error('Error adding user:', error);
            throw error;
        }
    }

    async getUser(userId) {
        try {
            const sql = `SELECT * FROM users WHERE id = ?`;
            return await this.get(sql, [userId]);
        } catch (error) {
            console.error('Error getting user:', error);
            throw error;
        }
    }

    async getAllUsers() {
        try {
            const sql = `SELECT * FROM users WHERE isActive = 1`;
            return await this.all(sql);
        } catch (error) {
            console.error('Error getting all users:', error);
            throw error;
        }
    }

    async updateUserBalance(userId, newSaldo) {
        try {
            const sql = `UPDATE users SET saldo = ?, sisaSaldo = ? WHERE id = ?`;
            await this.run(sql, [newSaldo, newSaldo, userId]);
            
            return await this.getUser(userId);
        } catch (error) {
            console.error('Error updating user balance:', error);
            throw error;
        }
    }

    async deductBalance(userId, amount) {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const newSisaSaldo = user.sisaSaldo - amount;
            if (newSisaSaldo < 0) {
                throw new Error('Insufficient balance');
            }

            const sql = `UPDATE users SET sisaSaldo = ? WHERE id = ?`;
            await this.run(sql, [newSisaSaldo, userId]);
            
            return await this.getUser(userId);
        } catch (error) {
            console.error('Error deducting balance:', error);
            throw error;
        }
    }

    async addBalance(userId, amount) {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const newSaldo = user.saldo + amount;
            const newSisaSaldo = user.sisaSaldo + amount;

            const sql = `UPDATE users SET saldo = ?, sisaSaldo = ? WHERE id = ?`;
            await this.run(sql, [newSaldo, newSisaSaldo, userId]);
            
            return await this.getUser(userId);
        } catch (error) {
            console.error('Error adding balance:', error);
            throw error;
        }
    }

    async resetBalance(userId) {
        try {
            const user = await this.getUser(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const sql = `UPDATE users SET saldo = saldoAwal, sisaSaldo = saldoAwal WHERE id = ?`;
            await this.run(sql, [userId]);
            
            return await this.getUser(userId);
        } catch (error) {
            console.error('Error resetting balance:', error);
            throw error;
        }
    }

    // Download operations
    async addDownload(userId, url, filename) {
        try {
            const sql = `INSERT INTO downloads (userId, url, filename) VALUES (?, ?, ?)`;
            const result = await this.run(sql, [userId, url, filename]);
            
            return await this.get(`SELECT * FROM downloads WHERE id = ?`, [result.lastID]);
        } catch (error) {
            console.error('Error adding download:', error);
            throw error;
        }
    }

    async getDownloadHistory(userId) {
        try {
            const sql = `SELECT * FROM downloads WHERE userId = ? ORDER BY timestamp DESC`;
            return await this.all(sql, [userId]);
        } catch (error) {
            console.error('Error getting download history:', error);
            throw error;
        }
    }

    async updateDownloadStatus(downloadId, status) {
        try {
            const sql = `UPDATE downloads SET status = ? WHERE id = ?`;
            await this.run(sql, [status, downloadId]);
            
            return await this.get(`SELECT * FROM downloads WHERE id = ?`, [downloadId]);
        } catch (error) {
            console.error('Error updating download status:', error);
            throw error;
        }
    }

    // Search operations
    async addSearch(userId, query, results) {
        try {
            const sql = `INSERT INTO searches (userId, query, results) VALUES (?, ?, ?)`;
            const resultsJson = JSON.stringify(results);
            const result = await this.run(sql, [userId, query, resultsJson]);
            
            return await this.get(`SELECT * FROM searches WHERE id = ?`, [result.lastID]);
        } catch (error) {
            console.error('Error adding search:', error);
            throw error;
        }
    }

    async getSearchHistory(userId) {
        try {
            const sql = `SELECT * FROM searches WHERE userId = ? ORDER BY timestamp DESC`;
            const searches = await this.all(sql, [userId]);
            
            // Parse JSON results
            return searches.map(s => ({
                ...s,
                results: s.results ? JSON.parse(s.results) : []
            }));
        } catch (error) {
            console.error('Error getting search history:', error);
            throw error;
        }
    }

    // Statistics
    async getStats() {
        try {
            const totalUsers = await this.get(`SELECT COUNT(*) as count FROM users`);
            const activeUsers = await this.get(`SELECT COUNT(*) as count FROM users WHERE isActive = 1`);
            const totalDownloads = await this.get(`SELECT COUNT(*) as count FROM downloads`);
            const totalSearches = await this.get(`SELECT COUNT(*) as count FROM searches`);

            return {
                totalUsers: totalUsers.count,
                activeUsers: activeUsers.count,
                totalDownloads: totalDownloads.count,
                totalSearches: totalSearches.count
            };
        } catch (error) {
            console.error('Error getting stats:', error);
            throw error;
        }
    }
}

// Export singleton instance
const db = new Database();
module.exports = db;
