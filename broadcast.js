const db = require('./db');

class BroadcastHandler {
    constructor() {
        this.adminIds = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
    }

    async send(message, args) {
        const senderId = message.userId || message.from?.id;
        
        // Check if user is admin
        if (!this.isAdmin(senderId)) {
            console.log(`❌ Unauthorized broadcast attempt by user ${senderId}`);
            return {
                success: false,
                message: 'You are not authorized to send broadcasts'
            };
        }

        const broadcastMessage = args.join(' ');
        
        if (!broadcastMessage) {
            return {
                success: false,
                message: 'Please provide a message to broadcast'
            };
        }

        try {
            const users = await db.getAllUsers();
            console.log(`📡 Broadcasting message to ${users.length} users...`);

            let successCount = 0;
            let failCount = 0;

            for (const user of users) {
                try {
                    await this.sendToUser(user.id, broadcastMessage);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to send to user ${user.id}:`, error);
                    failCount++;
                }
            }

            const result = {
                success: true,
                message: `Broadcast sent to ${successCount} users${failCount > 0 ? `, ${failCount} failed` : ''}`,
                stats: {
                    total: users.length,
                    success: successCount,
                    failed: failCount
                }
            };

            console.log(`✅ Broadcast complete:`, result.stats);
            return result;

        } catch (error) {
            console.error('❌ Broadcast error:', error);
            return {
                success: false,
                message: 'Failed to send broadcast',
                error: error.message
            };
        }
    }

    async sendToUser(userId, message) {
        // Simulate sending message
        // Replace with actual bot API call (Telegram, WhatsApp, etc.)
        console.log(`📤 Sending to user ${userId}: ${message.substring(0, 50)}...`);
        await this.delay(100); // Simulate API delay
        return true;
    }

    async sendToMultiple(userIds, message) {
        const results = [];
        
        for (const userId of userIds) {
            try {
                await this.sendToUser(userId, message);
                results.push({ userId, success: true });
            } catch (error) {
                results.push({ userId, success: false, error: error.message });
            }
        }

        return results;
    }

    isAdmin(userId) {
        return this.adminIds.includes(String(userId));
    }

    async schedulebroadcast(message, dateTime) {
        // Placeholder for scheduled broadcast functionality
        console.log(`📅 Broadcast scheduled for ${dateTime}`);
        return {
            success: true,
            message: 'Broadcast scheduled successfully',
            scheduledFor: dateTime
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
const broadcast = new BroadcastHandler();
module.exports = broadcast;
