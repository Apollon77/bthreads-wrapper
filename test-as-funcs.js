const BW = require('./index.js');
const path = require('path');

const wrapped = BW.getWorkerClass(path.join(__dirname, 'test', 'test-funcs.js'));


(async () => {
    console.log('getData1: ' + await wrapped.getData1());
})();
//console.log('getData1: ' + wrapped.getData1());

console.log('getDataCallback: ' + wrapped.returnValueCallback('call1', (data) => {
    console.log('DATA CALLBACK ' + data);
}));


(async () => {
        console.log('getDataAsync: ' + await wrapped.getDataAsync());
})();

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


