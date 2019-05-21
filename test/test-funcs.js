let data1 = 'init1';
let data2 = 'init2';

module.exports = {};

module.exports.setData = (_data1, _data2) => {
    data1 = _data1;
    data2 = _data2;
}

module.exports.setData1 = (_data1) => {
    data1 = _data1;
}

module.exports.setData2 = (_data2) => {
    data2 = _data2;
}

module.exports.getData1 = () => {
    return data1;
}

module.exports.getData2 = () => {
    return data2;
}

module.exports.getDataAsync = () => {
    console.log('WORKER-DATA1ASYNC');
    return new Promise((resolve, _reject) => {
        console.log('RESOLVE NOW');
        resolve([data1]);
    });
}

module.exports.emitBack = (data) => {
}

module.exports.returnValueCallback = (data, callback) => {
    callback(data);
}

module.exports.returnValue = (data) => {
    return data;
}

module.exports.job = (arg) => {
    return arg + ' world';
}
