require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');
const { handleSearch } = require('./handle/search');
const { handleTopup } = require('./handle/topup');

class MonsNodeBot {
    constructor() {
        this.port = process.env.PORT || 3000;
        this.userSessions = new Map(); // Store user search sessions
        this.botToken = process.env.BOT_TOKEN;
        
        if (!this.botToken) {
            throw new Error('BOT_TOKEN tidak ditemukan di file .env');
        }
        
        // Initialize Telegram Bot
        this.bot = new TelegramBot(this.botToken, { polling: true });
    }

    async init() {
        try {
            console.log('🚀 Initializing MONSNODE Bot...');
            
            // Initialize database
            await db.connect();
            console.log('✅ Database connected');

            // Start bot
            this.start();
        } catch (error) {
            console.error('❌ Error initializing bot:', error);
            process.exit(1);
        }
    }

    start() {
        console.log(`✅ MONSNODE Bot started successfully!`);
        console.log(`📡 Listening on port ${this.port}`);
        console.log('\n📝 Available Commands:');
        console.log('   /cari <query>  - Cari konten');
        console.log('   /topup <amount> - Top-up saldo');
        console.log('\n⏳ Waiting for commands...\n');
        
        // Setup Telegram Bot handlers
        this.setupTelegramHandlers();
    }

    setupTelegramHandlers() {
        // Handle all messages
        this.bot.on('message', async (msg) => {
            const chatId = msg.chat.id;
            const text = msg.text;

            console.log(`📨 Message from ${msg.from.first_name} (${msg.from.id}): ${text}`);

            // Convert Telegram message to our format
            const message = {
                userId: msg.from.id.toString(),
                from: {
                    id: msg.from.id.toString(),
                    username: msg.from.username || msg.from.first_name,
                    first_name: msg.from.first_name,
                    last_name: msg.from.last_name
                },
                text: text,
                chatId: chatId
            };

            // Process message
            const result = await this.processMessage(message);

            // Send response
            if (result) {
                // If result contains file to send
                if (result.sendFile && result.downloadResult && result.downloadResult.filepath) {
                    try {
                        // Send "downloading" status
                        await this.bot.sendMessage(chatId, '⏳ Mengunduh file...');
                        
                        // Send file
                        await this.bot.sendVideo(chatId, result.downloadResult.filepath, {
                            caption: `📹 ${result.selectedItem.title}\n👤 ${result.selectedItem.username}\n📦 ${result.downloadResult.size}`
                        });
                        
                        console.log(`✅ File sent to user ${msg.from.id}`);
                        
                        // Delete file after sending (optional)
                        const fs = require('fs');
                        fs.unlinkSync(result.downloadResult.filepath);
                        console.log(`🗑️  File deleted: ${result.downloadResult.filepath}`);
                        
                    } catch (error) {
                        console.error('❌ Error sending file:', error);
                        await this.bot.sendMessage(chatId, '❌ Gagal mengirim file: ' + error.message);
                    }
                } else if (result.message) {
                    // Send text message
                    await this.bot.sendMessage(chatId, result.message);
                }
            }
        });

        // Handle errors
        this.bot.on('polling_error', (error) => {
            console.error('❌ Telegram polling error:', error);
        });

        console.log('✅ Telegram Bot handlers setup complete');
    }

    async processMessage(message) {
        const text = message.text || '';
        
        // Check if message is a command
        if (text.startsWith('/')) {
            return await this.handleCommand(message);
        }
        
        // Check if user is selecting from search results
        if (this.userSessions.has(message.userId)) {
            return await this.handleSelection(message);
        }

        return null;
    }

    async handleCommand(message) {
        const text = message.text;
        const args = text.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        try {
            switch (command) {
                case 'cari':
                case 'search':
                    return await this.handleSearchCommand(message, args);
                    
                case 'topup':
                    return await this.handleTopupCommand(message, args);
                    
                default:
                    return {
                        success: false,
                        message: `❌ Perintah tidak dikenal: /${command}\n\n` +
                                `Gunakan:\n` +
                                `/cari [query] - Cari konten\n` +
                                `/topup [amount] - Top-up saldo`
                    };
            }
        } catch (error) {
            console.error(`❌ Error processing command ${command}:`, error);
            return {
                success: false,
                message: '❌ Terjadi kesalahan.',
                error: error.message
            };
        }
    }

    async handleSearchCommand(message, args) {
        const userId = message.userId || message.from?.id;

        // Ensure user is registered
        await this.ensureUserRegistered(message);

        // Perform search
        const searchResult = await handleSearch(message, args);

        if (searchResult.success && searchResult.results && searchResult.results.length > 0) {
            // Store search results in session
            this.userSessions.set(userId, {
                command: 'search',
                query: searchResult.query,
                results: searchResult.results,
                timestamp: Date.now()
            });

            // Format list for display
            const listMessage = this.formatSearchList(searchResult.results, searchResult.query);

            return {
                success: true,
                message: listMessage,
                results: searchResult.results,
                showSelection: true
            };
        }

        return searchResult;
    }

    async handleTopupCommand(message, args) {
        // Ensure user is registered
        await this.ensureUserRegistered(message);

        // Process topup
        return await handleTopup(message, args);
    }

    async handleSelection(message) {
        const userId = message.userId || message.from?.id;
        const session = this.userSessions.get(userId);

        if (!session || session.command !== 'search') {
            return null;
        }

        // Parse selection (expecting number)
        const selection = parseInt(message.text);

        if (isNaN(selection) || selection < 1 || selection > session.results.length) {
            return {
                success: false,
                message: `❌ Pilihan tidak valid. Pilih nomor 1-${session.results.length}`
            };
        }

        // Get selected item
        const selectedItem = session.results[selection - 1];

        console.log(`✅ User selected item ${selection}: ${selectedItem.title}`);

        // Download the selected item
        const { handleDownload } = require('./handle/download');
        const downloadResult = await handleDownload(message, [], selectedItem);

        if (downloadResult.success && downloadResult.needSendFile) {
            // Return result with file to send
            return {
                success: true,
                message: `📥 Mengirim: ${selectedItem.title}`,
                selectedItem: selectedItem,
                downloadResult: downloadResult,
                sendFile: true
            };
        }

        return downloadResult;
    }

    formatSearchList(results, query) {
        let message = `🔍 Hasil Pencarian: "${query}"\n`;
        message += `Ditemukan ${results.length} hasil\n\n`;

        results.forEach((item, index) => {
            message += `${index + 1}. ${item.title || item.filename || 'No Title'}\n`;
            if (item.description) {
                message += `   ${item.description.substring(0, 50)}...\n`;
            }
            if (item.category) {
                message += `   📁 ${item.category}\n`;
            }
            message += '\n';
        });

        message += `\n💡 Ketik nomor (1-${results.length}) untuk melihat preview`;

        return message;
    }

    formatPreview(item) {
        let preview = `📄 PREVIEW\n\n`;
        preview += `📌 Judul: ${item.title || 'No Title'}\n\n`;
        
        if (item.description) {
            preview += `📝 Deskripsi:\n${item.description}\n\n`;
        }
        
        if (item.url) {
            preview += `🔗 URL: ${item.url}\n`;
        }
        
        if (item.category) {
            preview += `📁 Kategori: ${item.category}\n`;
        }
        
        if (item.size) {
            preview += `📦 Size: ${item.size}\n`;
        }
        
        if (item.type) {
            preview += `📋 Type: ${item.type}\n`;
        }

        preview += `\n💡 Ketik nomor lain untuk melihat item lain`;

        return preview;
    }

    async ensureUserRegistered(message) {
        const userId = message.userId || message.from?.id;
        const username = message.from?.username || message.from?.first_name || 'User';
        const lastName = message.from?.last_name || '';
        
        // Check if user exists
        let user = await db.getUser(userId);
        
        if (!user) {
            console.log(`🔄 Auto-registering user ${userId}`);
            const defaultSaldo = parseFloat(process.env.DEFAULT_SALDO) || 0;
            user = await db.addUser(userId, username, lastName, defaultSaldo);
            console.log(`✅ User registered: ${username} (${userId})`);
        }
        
        return user;
    }

    clearUserSession(userId) {
        this.userSessions.delete(userId);
    }

    getUserSession(userId) {
        return this.userSessions.get(userId);
    }
}

// Start bot
const bot = new MonsNodeBot();
bot.init();

module.exports = bot;
