const BW = require('./index.js');
const path = require('path');

// Initialize Wrapped version of test-class (ES6 Class or function style)
const WrappedClass = BW.getWorkerClass({workerFileName: path.join(__dirname, 'test', 'test-class.js'), proxyEvents: true});
//const WrappedClass = BW.getWorkerClass({workerFileName: path.join(__dirname, 'test', 'test-funcClass.js'), proxyEvents: true});

// Create Wrapped instance of the remote object
const wrapped = new WrappedClass('d1', 'd2');

// Register an event (fired by getData1)
wrapped.on('ready', (a1, a2, a3) => {
    console.log('EVENT RECEIVED ' + a1 + ',' + a2 + ',' + a3);

    // Fire event
    wrapped.emit('setData1', 'new1');
});

(async () => {
    console.log('getData1: ' + await wrapped.getData1());
})();
//console.log('getData1: ' + wrapped.getData1());

/*
console.log('getDataCallback: ' + wrapped.getDataCallback((data1) => {
    console.log('DATA CALLBACK1 ' + data1);
}, (data2) => {
    console.log('DATA CALLBACK2 ' + data2);
}));
*/


/*(async () => {
        console.log('getDataAsync: ' + await wrapped.getDataAsync());
})();*/

/*
(async () => {
    console.log('getData1: ' + await wrapped.getData1());
})();

(async () => {
    console.log('getData2: ' + await wrapped.getData2());
})();

(async () => {
    console.log('setData2: ' + await wrapped.setData2('huhuuuu']));
})();

(async () => {
    console.log('getData2: ' + await wrapped.getData2());
})();

*/

// Destroy and end Thread after 5s
setTimeout(() => {
    wrapped.__destructWrapped();
}, 5000);


