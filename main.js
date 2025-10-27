require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');
const { handleSearch } = require('./handle/search');
const { handleTopup } = require('./handle/topup');
const { handleDownload } = require('./handle/download');
const { formatSearchList, createInlineKeyboard, cleanTitle } = require('./handle/ui');

class MonsNodeBot {
    constructor() {
        this.port = process.env.PORT || 3000;
        this.userSessions = new Map();
        this.botToken = process.env.BOT_TOKEN;
        
        if (!this.botToken) {
            throw new Error('BOT_TOKEN tidak ditemukan di file .env');
        }
        
        this.bot = new TelegramBot(this.botToken, { polling: true });
    }

    async init() {
        try {
            console.log('🚀 Initializing MONSNODE Bot...');
            await db.connect();
            console.log('✅ Database connected');
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
        
        this.setupHandlers();
    }

    setupHandlers() {
        // Handle messages
        this.bot.on('message', async (msg) => {
            await this.handleMessage(msg);
        });

        // Handle callback queries (inline keyboard)
        this.bot.on('callback_query', async (query) => {
            await this.handleCallbackQuery(query);
        });

        // Handle errors
        this.bot.on('polling_error', (error) => {
            console.error('❌ Telegram polling error:', error);
        });

        console.log('✅ Telegram Bot handlers setup complete');
    }

    async handleMessage(msg) {
        const chatId = msg.chat.id;
        const text = msg.text;

        console.log(`📨 Message from ${msg.from.first_name} (${msg.from.id}): ${text}`);

        const message = {
            userId: msg.from.id.toString(),
            from: msg.from,
            text: text,
            chatId: chatId
        };

        const result = await this.processMessage(message);
        await this.sendResponse(chatId, result);
    }

    async handleCallbackQuery(query) {
        const chatId = query.message.chat.id;
        const data = query.data;
        const userId = query.from.id.toString();

        console.log(`🖱️ Callback from ${query.from.first_name}: ${data}`);

        const session = this.userSessions.get(userId);
        if (!session) {
            await this.bot.answerCallbackQuery(query.id, { text: 'Session expired' });
            return;
        }

        if (data.startsWith('select_')) {
            const index = parseInt(data.split('_')[1]);
            await this.handleSelection(chatId, userId, index, query.id);
        } else if (data.startsWith('page_')) {
            const page = parseInt(data.split('_')[1]);
            await this.showPage(chatId, userId, page, query.message.message_id);
            await this.bot.answerCallbackQuery(query.id);
        }
    }

    async processMessage(message) {
        const text = message.text || '';
        
        if (text.startsWith('/')) {
            return await this.handleCommand(message);
        }
        
        return null;
    }

    async handleCommand(message) {
        const text = message.text;
        const args = text.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        try {
            await this.ensureUserRegistered(message);

            switch (command) {
                case 'cari':
                case 'search':
                    return await this.handleSearchCommand(message, args);
                    
                case 'topup':
                    return await handleTopup(message, args);
                    
                default:
                    return {
                        success: false,
                        message: `❌ Perintah tidak dikenal: /${command}\n\n` +
                                `Gunakan:\n/cari [query] - Cari konten\n/topup [amount] - Top-up saldo`
                    };
            }
        } catch (error) {
            console.error(`❌ Error processing command ${command}:`, error);
            return { success: false, message: '❌ Terjadi kesalahan.', error: error.message };
        }
    }

    async handleSearchCommand(message, args) {
        const userId = message.userId || message.from?.id;
        const searchResult = await handleSearch(message, args);

        if (searchResult.success && searchResult.results && searchResult.results.length > 0) {
            this.userSessions.set(userId, {
                command: 'search',
                query: searchResult.query,
                results: searchResult.results,
                timestamp: Date.now(),
                page: 0
            });

            const listMessage = formatSearchList(searchResult.results, searchResult.query, 0);
            const keyboard = createInlineKeyboard(searchResult.results, 0);

            return {
                success: true,
                message: listMessage,
                keyboard: keyboard,
                results: searchResult.results
            };
        }

        return searchResult;
    }

    async handleSelection(chatId, userId, index, queryId) {
        const session = this.userSessions.get(userId);
        if (!session || index >= session.results.length) {
            await this.bot.answerCallbackQuery(queryId, { text: '❌ Invalid selection' });
            return;
        }

        const selectedItem = session.results[index];
        console.log(`✅ User selected item ${index + 1}: ${selectedItem.title}`);

        await this.bot.answerCallbackQuery(queryId, { text: '⏳ Mengunduh...' });

        const message = { userId: userId, from: { id: userId } };
        const downloadResult = await handleDownload(message, [], selectedItem);

        if (downloadResult.success && downloadResult.needSendFile) {
            await this.sendFile(chatId, selectedItem, downloadResult);
        } else {
            await this.bot.sendMessage(chatId, downloadResult.message || '❌ Download gagal');
        }
    }

    async showPage(chatId, userId, page, messageId) {
        const session = this.userSessions.get(userId);
        if (!session) return;

        session.page = page;
        const listMessage = formatSearchList(session.results, session.query, page);
        const keyboard = createInlineKeyboard(session.results, page);

        await this.bot.editMessageText(listMessage, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: keyboard
        });
    }

    async sendResponse(chatId, result) {
        if (!result) return;

        if (result.keyboard) {
            await this.bot.sendMessage(chatId, result.message, {
                reply_markup: result.keyboard
            });
        } else if (result.message) {
            await this.bot.sendMessage(chatId, result.message);
        }
    }

    async sendFile(chatId, selectedItem, downloadResult) {
        try {
            const caption = `📹 ${cleanTitle(selectedItem.title)}\n👤 ${selectedItem.username || 'Unknown'}\n📦 ${downloadResult.size}`;
            
            await this.bot.sendVideo(chatId, downloadResult.filepath, { caption });
            
            console.log(`✅ File sent`);
            
            const fs = require('fs');
            fs.unlinkSync(downloadResult.filepath);
            console.log(`🗑️  File deleted`);
        } catch (error) {
            console.error('❌ Error sending file:', error);
            await this.bot.sendMessage(chatId, '❌ Gagal mengirim file: ' + error.message);
        }
    }

    async ensureUserRegistered(message) {
        const userId = message.userId || message.from?.id;
        const username = message.from?.username || message.from?.first_name || 'User';
        const lastName = message.from?.last_name || '';
        
        let user = await db.getUser(userId);
        
        if (!user) {
            console.log(`🔄 Auto-registering user ${userId}`);
            const defaultSaldo = parseFloat(process.env.DEFAULT_SALDO) || 0;
            user = await db.addUser(userId, username, lastName, defaultSaldo);
            console.log(`✅ User registered: ${username} (${userId})`);
        }
        
        return user;
    }
}

// Start bot
const bot = new MonsNodeBot();
bot.init();

module.exports = bot;

