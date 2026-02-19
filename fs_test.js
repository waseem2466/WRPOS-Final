const fs = require('fs');
fs.writeFileSync('fs_success.txt', 'FS is working at ' + new Date().toISOString());
console.log('FS Success');
