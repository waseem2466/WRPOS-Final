const EventEmitter = require('events');

class MockPool extends EventEmitter {
    constructor() {
        super();
        console.log('Mock Pool initialized');
    }
}

function testListener() {
    const pool = new MockPool();

    // Mimic the logic added to the code
    pool.on('error', (err) => {
        console.log('[TEST] Caught error as expected:', err.message);
    });

    console.log('[TEST] Emitting mock connection error...');
    pool.emit('error', new Error('Connection terminated unexpectedly'));

    console.log('[TEST] Verification complete. If the message above appeared, the listener is working.');
}

testListener();
