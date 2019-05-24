const EventEmitter = require('events');


class TestClass extends EventEmitter {

    constructor(data1, data2) {
        super();

        this.data1 = data1;
        this.data2 = data2;
        //setImmediate(() => {
        //    this.emit('ready', 'const', this.data1, this.data2);
        //});

        this.on('setData1', (data1) => {
            this.data1 = data1;
            console.log('WORKER-ON-DATA1 ' + data1);
            this.emit('LocalHuhu', data1);
        });
        this.on('setData1', (data1) => {
            console.log('WORKER-ON-DATA1-2 ' + data1);
        });
        this.on('LocalHuhu', (data1) => {
            console.log('LOCAL-HUHU ' + data1);
        });
    }

    setData(data1, data2) {
        this.setData1(data1);
        this.setData2(data1);
    }

    setData1(data1) {
        this.data1 = data1;
        console.log('WORKER-EMIT');
        this.emit('data1', 'data1', data1);
    }

    setData2(data2) {
        this.data2 = data2;
        console.log('WORKER-EMIT');
        this.emit('data2', 'data2', data2);
    }

    getDataCallback(callback1, callback2) {
        console.log('WORKER-CALLBACK');
        callback2 && callback2(this.data2);
        callback1 && callback1(this.data1);
    }

    getData1Async() {
        console.log('WORKER-DATA1ASYNC');
        return new Promise((resolve, _reject) => {
            console.log('RESOLVE NOW');
            resolve([this.data1, this.data2]);
        });
    }

    getData1() {
        console.log('WORKER-EMIT');
        this.emit('ready', 'get', this.data1, this.data2);
        return this.data1;
    }

    getData2() {
        return this.data2;
    }

    emitBack(data) {
        this.emit('dataproxy', 'data', data);
    }

    returnValueCallback(data, callback) {
        callback(data);
    }

    returnValue(data) {
        return data;
    }

    job(arg) {
        return arg + ' world';
    }
}

module.exports = TestClass;