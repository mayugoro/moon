const db = require('../db');

async function handleTopup(message, args) {
    const userId = message.userId || message.from?.id;
    const amount = parseFloat(args[0]);

    if (!amount || isNaN(amount) || amount <= 0) {
        console.log('❌ Invalid topup amount');
        return {
            success: false,
            message: 'Gunakan format: /topup <jumlah>\nContoh: /topup 50000'
        };
    }

    try {
        console.log(`💰 Topup request from user ${userId}: ${amount}`);

        // Check if user exists
        let user = await db.getUser(userId);
        
        if (!user) {
            // Auto-register user if not exists
            const username = message.from?.username || message.from?.first_name || 'User';
            const lastName = message.from?.last_name || '';
            user = await db.addUser(userId, username, lastName, 0);
            console.log(`✅ User auto-registered: ${userId}`);
        }

        // Add balance
        const updatedUser = await db.addBalance(userId, amount);

        console.log(`✅ Topup successful: ${amount} added to user ${userId}`);

        return {
            success: true,
            message: `✅ Top-up berhasil!\n\n` +
                    `💰 Jumlah: ${amount}\n` +
                    `💳 Saldo Baru: ${updatedUser.saldo}\n` +
                    `💵 Sisa Saldo: ${updatedUser.sisaSaldo}`,
            balance: {
                added: amount,
                total: updatedUser.saldo,
                available: updatedUser.sisaSaldo
            }
        };

    } catch (error) {
        console.error('❌ Topup error:', error);
        return {
            success: false,
            message: '❌ Top-up gagal. Silakan coba lagi.',
            error: error.message
        };
    }
}

async function getBalance(userId) {
    try {
        const user = await db.getUser(userId);
        
        if (!user) {
            return {
                success: false,
                message: '❌ User tidak ditemukan'
            };
        }

        return {
            success: true,
            balance: {
                saldoAwal: user.saldoAwal,
                saldo: user.saldo,
                sisaSaldo: user.sisaSaldo
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    handleTopup,
    getBalance
};
