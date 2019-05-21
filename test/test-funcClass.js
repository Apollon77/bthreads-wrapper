const EventEmitter = require('events').EventEmitter;
const util = require('util');

function TestClass(data1, data2) {
    this.data1 = data1;
    this.data2 = data2;
    /*setImmediate(() => {
        this.emit('ready', ['const', this.data1, this.data2]);
    });*/
    this.on('setData1', (data1) => {
        this.data1 = data1;
        console.log('WORKER-ON-DATA1 ' + data1);
        this.emit('LocalHuhu', data1);
    });
    this.on('LocalHuhu', (data1) => {
        console.log('LOCAL-HUHU ' + data1);
    });

    this.setData = (data1, data2) => {
        this.setData1(data1);
        this.setData2(data1);
    }

    this.setData1 = (data1) => {
        this.data1 = data1;
        this.emit('data1', data1);
    }

    this.setData2 = (data2) => {
        this.data2 = data2;
        this.emit('data2', data2);
    }

    this.getData1 = () => {
        this.emit('ready', 'get', this.data1, this.data2);
        return this.data1;
    }

    this.getData2 = () => {
        return this.data2;
    }

    this.emitBack = (data) => {
        this.emit('dataproxy', data);
    }

    this.returnValueCallback = (data, callback) => {
        callback(data);
    }

    this.returnValue = (data) => {
        return data;
    }

    this.job = (arg) => {
        return arg + ' world';
    }
}

util.inherits(TestClass, EventEmitter);

module.exports = TestClass;