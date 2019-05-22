const TestClass = require('./test-class.js');


function constructObject(data1, data2) {
    const instance = new TestClass(data1, data2);

    return instance;
}


// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = constructObject;
} else {
    // or start the instance directly
    constructObject('jup1', 'jup2');
}