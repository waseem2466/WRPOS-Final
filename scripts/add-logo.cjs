const fs = require('fs');

let content = fs.readFileSync('services/pdfService.ts', 'utf8');

// 1. Add getLogoData before export const pdfService
const getLogoDataCode = `const getLogoData = async (): Promise<string | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 500;
            const scale = Math.min(MAX_WIDTH / img.width, 1);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/png'));
            } else {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = 'logo.png';
    });
};

export const pdfService`;

content = content.replace('export const pdfService', getLogoDataCode);

// 2. Add yOffset logic inside generateInvoice
const beforeHeader = `        const pageWidth = doc.internal.pageSize.width;

        // Header`;

const afterHeader = `        const pageWidth = doc.internal.pageSize.width;
        let yOffset = 0;

        const logoData = await getLogoData();
        if (logoData) {
            const logoWidth = 40;
            const logoHeight = 40;
            doc.addImage(logoData, 'PNG', (pageWidth / 2) - (logoWidth / 2), 10, logoWidth, logoHeight);
            yOffset = 35; // shift down to accommodate logo
        }

        // Header`;

content = content.replace(beforeHeader, afterHeader);

// 3. Add yOffset to all coordinates
content = content.replace(/20, { align: 'center' }\);/g, "20 + yOffset, { align: 'center' });");
content = content.replace(/28, { align: 'center' }\);/g, "28 + yOffset, { align: 'center' });");
content = content.replace(/33, { align: 'center' }\);/g, "33 + yOffset, { align: 'center' });");
content = content.replace(/doc\.line\(15, 40, pageWidth - 15, 40\);/g, "doc.line(15, 40 + yOffset, pageWidth - 15, 40 + yOffset);");
content = content.replace(/15, 50\);/g, "15, 50 + yOffset);");
content = content.replace(/15, 58\);/g, "15, 58 + yOffset);");
content = content.replace(/15, 63\);/g, "15, 63 + yOffset);");
content = content.replace(/15, 68\);/g, "15, 68 + yOffset);");
content = content.replace(/pageWidth - 70, 50\);/g, "pageWidth - 70, 50 + yOffset);");
content = content.replace(/pageWidth - 70, 58\);/g, "pageWidth - 70, 58 + yOffset);");
content = content.replace(/pageWidth - 70, 63\);/g, "pageWidth - 70, 63 + yOffset);");
content = content.replace(/pageWidth - 70, 68, { maxWidth: 55 }\);/g, "pageWidth - 70, 68 + yOffset, { maxWidth: 55 });");
content = content.replace(/startY: 80,/g, "startY: 80 + yOffset,");

fs.writeFileSync('services/pdfService.ts', content);
console.log('PDF logo logic added successfully!');
