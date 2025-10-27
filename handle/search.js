const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const SEARCH_URL = process.env.URL || 'https://monsnode.com/';

async function handleSearch(message, args) {
    const userId = message.userId || message.from?.id;
    const query = args.join(' ');

    if (!query) {
        console.log('❌ No search query provided');
        return {
            success: false,
            message: 'Gunakan format: /cari <query>\nContoh: /cari tes'
        };
    }

    try {
        console.log(`🔍 Search request from user ${userId}: "${query}"`);

        // Perform search
        const results = await performSearch(query);

        // Save search to database
        await db.addSearch(userId, query, results);

        console.log(`✅ Search completed: ${results.length} result(s) found`);

        return {
            success: true,
            query: query,
            results: results,
            count: results.length,
            message: `Ditemukan ${results.length} hasil`
        };

    } catch (error) {
        console.error('❌ Search error:', error);
        return {
            success: false,
            message: 'Pencarian gagal',
            error: error.message
        };
    }
}

async function performSearch(query) {
    try {
        console.log(`Searching monsnode.com for: "${query}"`);
        
        // Step 1: Initial search request
        const searchUrl = `${SEARCH_URL}search.php`;
        const params = {
            search: query
        };

        console.log(`📡 GET ${searchUrl}?search=${query}`);
        
        const response = await axios.get(searchUrl, {
            params: params,
            maxRedirects: 5,
            validateStatus: function (status) {
                return status >= 200 && status < 400; // Accept redirects
            }
        });

        console.log(`✅ Response status: ${response.status}`);
        console.log(`📍 Final URL: ${response.request.res.responseUrl || searchUrl}`);

        // Parse the response to extract results
        const results = parseSearchResults(response.data, query);

        return results;

    } catch (error) {
        console.error('Search API error:', error.message);
        throw new Error(`Search API error: ${error.message}`);
    }
}

function parseSearchResults(htmlData, query) {
    try {
        const results = [];
        
        console.log('⚠️  Parsing search results...');
        console.log('HTML length:', htmlData.length);
        
        // Save HTML for debugging (first time only)
        const debugFile = path.join(__dirname, '..', 'debug_search.html');
        if (!fs.existsSync(debugFile)) {
            fs.writeFileSync(debugFile, htmlData, 'utf8');
            console.log('💾 HTML saved to debug_search.html for inspection');
        }
        
        // Load HTML with cheerio
        const $ = cheerio.load(htmlData);
        
        // Parse .listn items (specific to monsnode.com)
        const items = $('.listn');
        
        if (items.length > 0) {
            console.log(`✅ Found ${items.length} results in .listn`);
            
            items.each((index, element) => {
                const $item = $(element);
                const id = $item.attr('id');
                
                // Get title/username from .user div
                const username = $item.find('.user a span').text().trim();
                
                // Get image
                const img = $item.find('img').attr('src');
                const imgAlt = $item.find('img').attr('alt');
                
                // Get main link (redirect.php) - this contains the video ID
                const redirectLink = $item.find('a[href*="redirect.php"]').attr('href');
                
                // Extract video ID from redirect.php?v=XXXXX
                let videoId = null;
                if (redirectLink) {
                    const match = redirectLink.match(/[?&]v=(\d+)/);
                    if (match) {
                        videoId = match[1];
                    }
                }
                
                // Build the actual detail page URL (twjn.php format)
                const detailUrl = videoId ? `${SEARCH_URL}twjn.php?v=${videoId}` : '';
                
                results.push({
                    id: id || `result_${index}`,
                    title: imgAlt || username || `Video ${index + 1}`,
                    username: username,
                    thumbnail: img,
                    url: detailUrl,
                    videoId: videoId,
                    description: imgAlt || '',
                    category: 'video',
                    query: query,
                    timestamp: new Date()
                });
            });
            
            console.log(`✅ Parsed ${results.length} video results`);
            return results;
        }
        
        // Fallback: if no .listn found
        console.log('⚠️  No .listn elements found, using fallback parser...');
        
        const allLinks = $('a[href]');
        console.log(`📊 Total links found: ${allLinks.length}`);
        
        allLinks.each((index, element) => {
            const $el = $(element);
            const title = $el.text().trim();
            const url = $el.attr('href');
            
            if (title && 
                url && 
                title.length > 5 && 
                title.length < 200 &&
                !url.includes('javascript:') &&
                !title.toLowerCase().includes('home') &&
                !title.toLowerCase().includes('menu')) {
                
                results.push({
                    id: `result_${Date.now()}_${index}`,
                    title: title,
                    url: url.startsWith('http') ? url : `${SEARCH_URL}${url}`,
                    description: title,
                    query: query,
                    timestamp: new Date()
                });
            }
        });
        
        if (results.length > 20) {
            results.splice(20);
        }
        
        console.log(`✅ Parsed ${results.length} results`);
        return results;
        
    } catch (error) {
        console.error('Error parsing search results:', error);
        return [];
    }
}

async function searchByCategory(query, category) {
    try {
        console.log(`🔍 Searching in category "${category}": ${query}`);
        
        const results = await performSearch(query);
        
        // Filter by category
        const filtered = results.filter(r => 
            r.category && r.category.toLowerCase() === category.toLowerCase()
        );

        return {
            success: true,
            query: query,
            category: category,
            results: filtered,
            count: filtered.length
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function advancedSearch(options) {
    const {
        query,
        category,
        limit = 10,
        sortBy = 'relevance',
        filters = {}
    } = options;

    try {
        let results = await performSearch(query);

        // Apply category filter
        if (category) {
            results = results.filter(r => r.category === category);
        }

        // Apply custom filters
        Object.keys(filters).forEach(key => {
            results = results.filter(r => r[key] === filters[key]);
        });

        // Sort results
        results = sortResults(results, sortBy);

        // Limit results
        results = results.slice(0, limit);

        return {
            success: true,
            query: query,
            results: results,
            count: results.length,
            options: { category, limit, sortBy }
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

function generateMockResults(query) {
    // Generate mock search results for demonstration
    const categories = ['video', 'audio', 'image', 'document', 'other'];
    const results = [];

    const numResults = Math.floor(Math.random() * 10) + 5;

    for (let i = 0; i < numResults; i++) {
        results.push({
            id: `result_${Date.now()}_${i}`,
            title: `${query} - Result ${i + 1}`,
            description: `This is a search result for "${query}". Lorem ipsum dolor sit amet.`,
            url: `https://example.com/result/${i + 1}`,
            category: categories[Math.floor(Math.random() * categories.length)],
            relevance: Math.random(),
            timestamp: new Date()
        });
    }

    return results;
}

function sortResults(results, sortBy) {
    switch (sortBy.toLowerCase()) {
        case 'relevance':
            return results.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));
        
        case 'date':
        case 'newest':
            return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        case 'oldest':
            return results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        case 'title':
            return results.sort((a, b) => a.title.localeCompare(b.title));
        
        default:
            return results;
    }
}

function formatSearchResults(results) {
    if (!results || results.length === 0) {
        return 'No results found';
    }

    let formatted = `🔍 Search Results (${results.length}):\n\n`;

    results.forEach((result, index) => {
        formatted += `${index + 1}. ${result.title}\n`;
        formatted += `   ${result.description}\n`;
        formatted += `   🔗 ${result.url}\n`;
        formatted += `   📁 Category: ${result.category}\n\n`;
    });

    return formatted;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    handleSearch,
    performSearch,
    searchByCategory,
    advancedSearch,
    formatSearchResults
};

// Function to get actual video URL from detail page
async function getActualVideoUrl(detailUrl) {
    try {
        console.log(`🔍 Fetching actual video URL from: ${detailUrl}`);
        
        const response = await axios.get(detailUrl);
        const $ = cheerio.load(response.data);
        
        // Pattern 1: Look for direct link with video.twimg.com
        // The URL is in <a> tag text content
        let videoUrl = null;
        
        $('a[href*="video.twimg.com"]').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            
            // Check if href contains video.twimg.com and .mp4
            if (href && href.includes('video.twimg.com') && href.includes('.mp4')) {
                videoUrl = href;
                return false; // break
            }
            
            // Check if text content contains the URL
            if (text && text.includes('video.twimg.com') && text.includes('.mp4')) {
                videoUrl = text;
                return false; // break
            }
        });
        
        // Pattern 2: Look for <video> tag source
        if (!videoUrl) {
            videoUrl = $('video source').attr('src');
        }
        
        // Pattern 3: Search in script tags for video URL
        if (!videoUrl) {
            const scripts = $('script').toArray();
            for (const script of scripts) {
                const scriptContent = $(script).html();
                if (scriptContent) {
                    // Look for video.twimg.com URLs
                    const match = scriptContent.match(/https:\/\/video\.twimg\.com\/[^"'\s]+\.mp4[^"'\s]*/);
                    if (match) {
                        videoUrl = match[0];
                        break;
                    }
                }
            }
        }
        
        // Pattern 4: Search in all page text
        if (!videoUrl) {
            const pageHtml = response.data;
            const match = pageHtml.match(/https:\/\/video\.twimg\.com\/ext_tw_video\/\d+\/pu\/vid\/\d+x\d+\/[^"'\s<>]+\.mp4[^"'\s<>]*/);
            if (match) {
                videoUrl = match[0];
            }
        }
        
        if (videoUrl) {
            console.log(`✅ Found video URL: ${videoUrl}`);
            return videoUrl;
        }
        
        console.log('⚠️  Video URL not found in detail page');
        return null;
        
    } catch (error) {
        console.error('Error fetching video URL:', error.message);
        return null;
    }
}

module.exports.getActualVideoUrl = getActualVideoUrl;
