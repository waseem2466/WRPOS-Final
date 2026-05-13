/**
 * Product & Price Handler — Intelligent product search and pricing
 * Handles product queries, price comparisons, and availability checks
 */

const { searchInventory } = require('./dbHelper.cjs');

/**
 * Get product details with pricing and stock
 */
async function getProductDetails(query) {
    if (!query || query.length < 2) return null;

    try {
        const products = await searchInventory(query);

        if (products.length === 0) {
            return {
                found: false,
                message: `Sorry, we don't have "${query}" in stock. Try searching for something else, or contact us at 0701234567.`
            };
        }

        if (products.length === 1) {
            const p = products[0];
            return {
                found: true,
                single: true,
                product: p,
                formatted: `✅ *${p.name}*\n📦 Category: ${p.category}\n💰 Price: Rs. ${p.price}\n📊 Stock: ${p.stock} available\n\nWould you like more details or quantity info?`
            };
        }

        // Multiple products found
        return {
            found: true,
            multiple: true,
            products: products.slice(0, 3),
            formatted: `Found ${products.length} products matching "${query}":\n\n` +
                products.slice(0, 3).map((p, i) =>
                    `${i + 1}. *${p.name}* - Rs. ${p.price} (Stock: ${p.stock})`
                ).join('\n') +
                `\n\nReply with product name for more details.`
        };
    } catch (err) {
        console.error('[Product Handler] Search error:', err.message);
        return {
            found: false,
            message: 'Error searching products. Please try again or call us.'
        };
    }
}

/**
 * Compare prices across multiple products
 */
async function comparePrices(products) {
    if (!products || products.length < 2) return null;

    const results = await Promise.all(
        products.map(p => searchInventory(p).then(res => res[0]))
    );

    const valid = results.filter(p => p);
    if (valid.length < 2) return null;

    const sorted = valid.sort((a, b) => a.price - b.price);
    const lowest = sorted[0];
    const highest = sorted[sorted.length - 1];
    const savings = highest.price - lowest.price;

    return {
        formatted: `📊 *Price Comparison*\n\n` +
            `💚 Lowest: *${lowest.name}* - Rs. ${lowest.price}\n` +
            `💔 Highest: *${highest.name}* - Rs. ${highest.price}\n` +
            `💰 Difference: Rs. ${savings}\n\n` +
            `Would you like to order the cheapest option?`
    };
}

/**
 * Check stock availability
 */
async function checkStock(productName) {
    if (!productName) return null;

    try {
        const products = await searchInventory(productName);

        if (products.length === 0) {
            return {
                available: false,
                message: `"${productName}" is currently out of stock. We can notify you when it arrives!`
            };
        }

        const p = products[0];
        const stockStatus = p.stock > 10 ? 'plenty' :
                           p.stock > 5 ? 'some' :
                           p.stock > 0 ? 'limited' : 'none';

        return {
            available: p.stock > 0,
            product: p,
            stockLevel: stockStatus,
            formatted: p.stock > 0 ?
                `✅ *${p.name}* is in stock!\n📦 Available: ${p.stock} units\n💰 Price: Rs. ${p.price}` :
                `❌ *${p.name}* is out of stock.\nWe'll notify you when it arrives!`
        };
    } catch (err) {
        console.error('[Stock Handler] Error:', err.message);
        return {
            available: false,
            message: 'Error checking stock. Please call us at 0701234567.'
        };
    }
}

/**
 * Generate bulk order quote
 */
async function generateBulkQuote(productName, quantity) {
    if (!productName || !quantity || isNaN(quantity)) return null;

    try {
        const products = await searchInventory(productName);
        if (products.length === 0) return null;

        const p = products[0];
        const unitPrice = p.price;
        const totalPrice = unitPrice * quantity;

        // Apply bulk discounts
        let discount = 0;
        if (quantity >= 100) discount = 0.15; // 15% for 100+
        else if (quantity >= 50) discount = 0.10; // 10% for 50+
        else if (quantity >= 20) discount = 0.05; // 5% for 20+

        const discountAmount = totalPrice * discount;
        const finalPrice = totalPrice - discountAmount;

        let discountText = '';
        if (discount > 0) {
            discountText = `\n💰 Bulk Discount (${Math.round(discount * 100)}%): -Rs. ${Math.round(discountAmount)}`;
        }

        return {
            formatted: `📋 *Bulk Order Quote*\n\n` +
                `Product: *${p.name}*\n` +
                `Quantity: ${quantity} units\n` +
                `Unit Price: Rs. ${unitPrice}\n` +
                `Subtotal: Rs. ${totalPrice}` +
                discountText +
                `\n*Final Total: Rs. ${Math.round(finalPrice)}*\n\n` +
                `Reply "OK" to confirm or "Change qty" to update. Call 0701234567 for custom quotes.`,
            product: p,
            quantity: quantity,
            unitPrice: unitPrice,
            subtotal: totalPrice,
            discount: discount,
                discountAmount: discountAmount,
            finalPrice: finalPrice
        };
    } catch (err) {
        console.error('[Bulk Quote] Error:', err.message);
        return null;
    }
}

/**
 * Get popular/trending products
 */
async function getTrendingProducts() {
    try {
        const products = await searchInventory('');
        if (products.length === 0) return null;

        // Simple trending: top 5 by stock (assuming popular items are kept in stock)
        const trending = products
            .sort((a, b) => b.stock - a.stock)
            .slice(0, 5);

        return {
            formatted: `🔥 *Trending Products*\n\n` +
                trending.map((p, i) =>
                    `${i + 1}. ${p.name} - Rs. ${p.price} (${p.stock} in stock)`
                ).join('\n') +
                `\n\nReply with product name to get details!`,
            products: trending
        };
    } catch (err) {
        console.error('[Trending] Error:', err.message);
        return null;
    }
}

/**
 * Handle "how much is" or "what's the price" queries
 */
async function handlePriceQuery(text) {
    // Extract product name from various patterns
    const patterns = [
        /(?:price|cost|rate).*?(?:of|for|on)?\s+(.+?)(?:\?|$)/i,
        /how much.*?(?:for|is)?\s+(.+?)(?:\?|$)/i,
        /(?:do you sell|have you got)\s+(.+?)(?:\?|$)/i,
        /(.+?)\s*(?:price|cost)?(?:\?|$)/i
    ];

    let productName = null;
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            productName = match[1].trim();
            break;
        }
    }

    if (!productName || productName.length < 2) {
        return {
            handled: false
        };
    }

    const result = await getProductDetails(productName);
    return {
        handled: !!result,
        reply: result?.formatted || '',
        product: result?.product
    };
}

/**
 * Handle "do you have" or stock availability queries
 */
async function handleAvailabilityQuery(text) {
    const patterns = [
        /(?:do you have|is there|got|stock|available)\s+(.+?)(?:\?|$)/i,
        /(.+?)\s+(?:in stock|available|have you)(?:\?|$)/i
    ];

    let productName = null;
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            productName = match[1].trim();
            break;
        }
    }

    if (!productName || productName.length < 2) {
        return { handled: false };
    }

    const result = await checkStock(productName);
    return {
        handled: !!result,
        reply: result?.formatted || '',
        product: result?.product
    };
}

/**
 * Handle bulk order queries
 */
async function handleBulkOrderQuery(text) {
    // Pattern: "I need 50 [product name]" or "Can I order 100 of [product]"
    const patterns = [
        /(?:need|want|order|buy)\s+(\d+)\s+(?:of\s+)?(.+?)(?:\?|$)/i,
        /(\d+)\s+(?:of\s+)?(.+?)\s+(?:needed|required)(?:\?|$)/i
    ];

    let quantity = null;
    let productName = null;

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1] && match[2]) {
            quantity = parseInt(match[1]);
            productName = match[2].trim();
            break;
        }
    }

    if (!quantity || !productName) {
        return { handled: false };
    }

    const result = await generateBulkQuote(productName, quantity);
    return {
        handled: !!result,
        reply: result?.formatted || '',
        quote: result
    };
}

module.exports = {
    getProductDetails,
    comparePrices,
    checkStock,
    generateBulkQuote,
    getTrendingProducts,
    handlePriceQuery,
    handleAvailabilityQuery,
    handleBulkOrderQuery
};
