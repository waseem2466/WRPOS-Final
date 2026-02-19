try {
    const electron = require('electron');
    console.log('electron type:', typeof electron);
    console.log('electron value:', electron);

    const { app } = require('electron');
    console.log('app type from destructure:', typeof app);

    if (typeof app !== 'undefined') {
        console.log('SUCCESS');
    } else {
        console.log('STILL FAILURE');
    }
} catch (e) {
    console.log('ERROR:', e.message);
}
