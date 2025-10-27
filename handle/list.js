const db = require('../db');

async function handleList(message, args) {
    const userId = message.userId || message.from?.id;
    const listType = args[0] || 'all';

    try {
        console.log(`📋 List request from user ${userId}, type: ${listType}`);

        let result;

        switch (listType.toLowerCase()) {
            case 'downloads':
            case 'download':
                result = await listDownloads(userId);
                break;

            case 'searches':
            case 'search':
                result = await listSearches(userId);
                break;

            case 'users':
                result = await listUsers();
                break;

            case 'stats':
            case 'statistics':
                result = await getStatistics();
                break;

            case 'all':
            default:
                result = await listAll(userId);
                break;
        }

        return result;

    } catch (error) {
        console.error('❌ List error:', error);
        return {
            success: false,
            message: 'Failed to retrieve list',
            error: error.message
        };
    }
}

async function listDownloads(userId) {
    try {
        const downloads = await db.getDownloadHistory(userId);
        
        return {
            success: true,
            type: 'downloads',
            items: downloads,
            count: downloads.length,
            message: `Found ${downloads.length} download(s)`
        };
    } catch (error) {
        throw error;
    }
}

async function listSearches(userId) {
    try {
        const searches = await db.getSearchHistory(userId);
        
        return {
            success: true,
            type: 'searches',
            items: searches,
            count: searches.length,
            message: `Found ${searches.length} search(es)`
        };
    } catch (error) {
        throw error;
    }
}

async function listUsers() {
    try {
        const users = await db.getAllUsers();
        
        return {
            success: true,
            type: 'users',
            items: users,
            count: users.length,
            message: `Found ${users.length} active user(s)`
        };
    } catch (error) {
        throw error;
    }
}

async function getStatistics() {
    try {
        const stats = await db.getStats();
        
        return {
            success: true,
            type: 'statistics',
            data: stats,
            message: 'Statistics retrieved successfully'
        };
    } catch (error) {
        throw error;
    }
}

async function listAll(userId) {
    try {
        const downloads = await db.getDownloadHistory(userId);
        const searches = await db.getSearchHistory(userId);
        const stats = await db.getStats();

        return {
            success: true,
            type: 'all',
            data: {
                downloads: {
                    items: downloads,
                    count: downloads.length
                },
                searches: {
                    items: searches,
                    count: searches.length
                },
                stats: stats
            },
            message: 'All data retrieved successfully'
        };
    } catch (error) {
        throw error;
    }
}

function formatList(items, type) {
    if (!items || items.length === 0) {
        return `No ${type} found`;
    }

    let formatted = `📋 ${type.toUpperCase()} (${items.length}):\n\n`;
    
    items.forEach((item, index) => {
        formatted += `${index + 1}. `;
        
        switch (type) {
            case 'downloads':
                formatted += `${item.filename || item.url}\n`;
                formatted += `   Status: ${item.status}, Date: ${new Date(item.timestamp).toLocaleDateString()}\n`;
                break;
                
            case 'searches':
                formatted += `"${item.query}"\n`;
                formatted += `   Results: ${item.results?.length || 0}, Date: ${new Date(item.timestamp).toLocaleDateString()}\n`;
                break;
                
            case 'users':
                formatted += `${item.username || 'User ' + item.id}\n`;
                formatted += `   Joined: ${new Date(item.joinedAt).toLocaleDateString()}\n`;
                break;
        }
        
        formatted += '\n';
    });

    return formatted;
}

module.exports = {
    handleList,
    listDownloads,
    listSearches,
    listUsers,
    getStatistics,
    formatList
};
