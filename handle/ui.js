// Telegram UI Handler
const ITEMS_PER_PAGE = 5;

const formatSearchList = (results, query, page = 0) => {
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const startIdx = page * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, results.length);
    const pageItems = results.slice(startIdx, endIdx);

    let message = `🔍 "${query}"\n`;
    message += `📊 ${results.length} video | Hal ${page + 1}/${totalPages}\n\n`;

    pageItems.forEach((item, idx) => {
        const globalIndex = startIdx + idx;
        
        // Clean title - remove hashtags and URLs
        let cleanTitle = item.title || 'Video';
        cleanTitle = cleanTitle.split('http')[0]; // Remove URLs
        cleanTitle = cleanTitle.split('#')[0]; // Remove hashtags
        cleanTitle = cleanTitle.trim();
        
        // Limit title length to keep message short
        if (cleanTitle.length > 45) {
            cleanTitle = cleanTitle.substring(0, 45) + '...';
        }
        
        message += `${globalIndex + 1}. ${cleanTitle}\n`;
        
        // Show username if available (keep it short)
        if (item.username) {
            const username = item.username.length > 15 
                ? item.username.substring(0, 15) + '...' 
                : item.username;
            message += `   👤 ${username}\n`;
        }
    });

    message += `\n💡 Klik nomor untuk preview`;

    return message;
};

const createInlineKeyboard = (results, page = 0) => {
    const buttons = [];
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const startIdx = page * ITEMS_PER_PAGE;
    const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, results.length);
    
    // Create number buttons for items on current page (max 5)
    const numberRow = [];
    for (let i = startIdx; i < endIdx; i++) {
        numberRow.push({
            text: `${i + 1}`,
            callback_data: `select_${i}`
        });
    }
    
    // All 5 buttons in ONE row
    if (numberRow.length > 0) {
        buttons.push(numberRow);
    }
    
    // Add navigation buttons
    const navRow = [];
    if (page > 0) {
        navRow.push({
            text: '◀️ Prev',
            callback_data: `page_${page - 1}`
        });
    }
    
    // Page indicator
    navRow.push({
        text: `${page + 1}/${totalPages}`,
        callback_data: `info`
    });
    
    if (page < totalPages - 1) {
        navRow.push({
            text: 'Next ▶️',
            callback_data: `page_${page + 1}`
        });
    }
    
    if (navRow.length > 0) {
        buttons.push(navRow);
    }
    
    return {
        inline_keyboard: buttons
    };
};

const cleanTitle = (title) => {
    let clean = title || 'Video';
    clean = clean.split('http')[0].split('#')[0].trim();
    if (clean.length > 100) {
        clean = clean.substring(0, 100) + '...';
    }
    return clean;
};

const formatPreview = (item, index) => {
    let message = `📹 PREVIEW VIDEO #${index + 1}\n\n`;
    
    // Title
    let title = item.title || 'Video';
    title = title.split('http')[0].trim();
    if (title.length > 150) {
        title = title.substring(0, 150) + '...';
    }
    message += `📌 ${title}\n\n`;
    
    // Username
    if (item.username) {
        message += `👤 ${item.username}\n`;
    }
    
    // Video ID
    if (item.videoId) {
        message += `🆔 ID: ${item.videoId}\n`;
    }
    
    message += `\n💡 Klik "Download" untuk mengunduh video`;
    
    return message;
};

const createPreviewKeyboard = (itemIndex, videoUrl = null) => {
    const keyboard = [];
    
    // First row: Tonton and Download
    const firstRow = [];
    
    // Tonton button - Always callback (will deduct balance on confirmation)
    if (videoUrl) {
        firstRow.push({
            text: '📺 TONTON',
            callback_data: `watch_${itemIndex}`
        });
    } else {
        // Disabled if no video URL or insufficient balance
        firstRow.push({
            text: '⛔ TONTON',
            callback_data: `watch_disabled_${itemIndex}`
        });
    }
    
    firstRow.push({
        text: '⬇️ DOWNLOAD',
        callback_data: `download_${itemIndex}`
    });
    
    keyboard.push(firstRow);
    
    // Second row: Kembali
    keyboard.push([
        {
            text: '🔙 KEMBALI',
            callback_data: `back_to_list`
        }
    ]);
    
    return {
        inline_keyboard: keyboard
    };
};

module.exports = {
    formatSearchList,
    createInlineKeyboard,
    cleanTitle,
    formatPreview,
    createPreviewKeyboard
};
