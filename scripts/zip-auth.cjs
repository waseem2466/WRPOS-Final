const AdmZip = require('adm-zip');
const path = require('path');

const zip = new AdmZip();
zip.addLocalFolder(path.join(__dirname, '..', 'wr-cloud-bot', 'baileys_auth_info'), 'baileys_auth_info');
zip.writeZip(path.join(__dirname, '..', 'wr-cloud-bot', 'auth.bin'));
console.log('✅ Created auth.bin with cross-platform Linux paths!');
