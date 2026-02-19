const { app } = require('electron');
console.log('App object type:', typeof app);
if (app) {
    console.log('SUCCESS: App object found!');
    process.exit(0);
} else {
    console.log('FAILURE: App object is undefined.');
    console.log('Electron module value:', require('electron'));
    process.exit(1);
}
