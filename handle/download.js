const axios = require('axios');
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function handleDownload(message, args, selectedItem = null) {
    const userId = message.userId || message.from?.id;
    
    // If selectedItem is provided (from search selection), use that
    let url, filename;
    
    if (selectedItem) {
        // Get actual video URL from detail page
        const { getActualVideoUrl } = require('./search');
        
        console.log(`🔗 Getting actual video URL from: ${selectedItem.url}`);
        const actualVideoUrl = await getActualVideoUrl(selectedItem.url);
        
        if (!actualVideoUrl) {
            return {
                success: false,
                message: '❌ Tidak dapat menemukan URL video. Silakan coba lagi.'
            };
        }
        
        url = actualVideoUrl;
        filename = `${selectedItem.username || 'video'}_${selectedItem.id}.mp4`;
    } else {
        // Download from direct URL command
        url = args[0];
        filename = extractFilename(url);
    }

    if (!url) {
        console.log('❌ No URL provided for download');
        return {
            success: false,
            message: 'Please provide a URL to download'
        };
    }

    // Validate URL
    if (!isValidUrl(url)) {
        return {
            success: false,
            message: 'Invalid URL format'
        };
    }

    try {
        console.log(`📥 Download request from user ${userId}: ${url}`);

        // Save download request to database
        const download = await db.addDownload(userId, url, filename);
        
        // Start download process
        await db.updateDownloadStatus(download.id, 'downloading');
        
        const result = await downloadFile(url, filename);
        
        if (result.success) {
            await db.updateDownloadStatus(download.id, 'completed');
            console.log(`✅ Download completed: ${result.filename}`);
            
            return {
                success: true,
                message: '✅ Download completed successfully',
                filename: result.filename,
                filepath: result.filepath,
                size: result.size,
                downloadId: download.id,
                needSendFile: true  // Flag to send file to user
            };
        } else {
            await db.updateDownloadStatus(download.id, 'failed');
            throw new Error(result.error);
        }

    } catch (error) {
        console.error('❌ Download error:', error);
        return {
            success: false,
            message: '❌ Download failed: ' + error.message,
            error: error.message
        };
    }
}

async function downloadFile(url, filename) {
    try {
        console.log(`Downloading from: ${url}`);
        
        // Create downloads directory if not exists
        const downloadDir = path.join(__dirname, '..', 'downloads');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }
        
        const filepath = path.join(downloadDir, filename);
        
        // Download file
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 60000, // 60 seconds timeout
            maxRedirects: 5
        });
        
        const contentLength = response.headers['content-length'];
        const contentType = response.headers['content-type'];
        
        console.log(`📦 File size: ${contentLength ? formatBytes(contentLength) : 'unknown'}`);
        console.log(`📋 Content type: ${contentType || 'unknown'}`);
        
        // Save file to disk
        const writer = fs.createWriteStream(filepath);
        
        response.data.pipe(writer);
        
        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                const stats = fs.statSync(filepath);
                resolve({
                    success: true,
                    filename: filename,
                    filepath: filepath,
                    size: formatBytes(stats.size),
                    sizeBytes: stats.size,
                    type: contentType || 'unknown'
                });
            });
            
            writer.on('error', (error) => {
                reject({
                    success: false,
                    error: error.message
                });
            });
        });

    } catch (error) {
        console.error('Download error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function getDownloadHistory(userId) {
    try {
        const history = await db.getDownloadHistory(userId);
        return {
            success: true,
            downloads: history,
            count: history.length
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

function extractFilename(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
        return filename || `download_${Date.now()}.mp4`;
    } catch (error) {
        return `download_${Date.now()}.mp4`;
    }
}

module.exports = {
    handleDownload,
    getDownloadHistory,
    downloadFile
};
