export function detectIntent(text) {
    const t = text.toLowerCase();

    if (t.includes('price') || t.includes('rate'))
        return 'PRICE';

    if (t.includes('invoice') || t.includes('bill'))
        return 'INVOICE';

    if (t.includes('hi') || t.includes('hello') || t.includes('hey'))
        return 'GREETING';

    if (t.includes('location') || t.includes('address') || t.includes('where are you'))
        return 'LOCATION';

    if (t.includes('thank you') || t.includes('thanks'))
        return 'THANKS';

    if (t.includes('bye') || t.includes('goodbye'))
        return 'GOODBYE';

    return 'GENERAL';
}
