# bthreads-wrapper

[![NPM version](http://img.shields.io/npm/v/bthreads-wrapper.svg)](https://www.npmjs.com/package/bthreads-wrapper)
[![Downloads](https://img.shields.io/npm/dm/bthreads-wrapper.svg)](https://www.npmjs.com/package/bthreads-wrapper)

**Tests:** Linux/Mac/Windows: [![Travis-CI](http://img.shields.io/travis/Apollon77/bthreads-wrapper/master.svg)](https://travis-ci.org/Apollon77/bthreads-wrapper)
Windows: [![AppVeyor](https://ci.appveyor.com/api/projects/status/github/Apollon77/bthreads-wrapper?branch=master&svg=true)](https://ci.appveyor.com/project/Apollon77/ioBroker-daikin/)

[![NPM](https://nodei.co/npm/bthreads-wrapper.png?downloads=true)](https://nodei.co/npm/bthreads-wrapper/)

This Library provides an object/class/instance/function wrapper to real logic executed by bthreads (e.g. child_process or worker_threads). The idea is that the real object and logic runs in a different thread, but can be used locally in your code as if the object would just have been required. The limitations are listed below.

## What do the library supports?
Basically as normal for worker_threads you set the JavaScript file to be used. This file can provide:
* an ES6 Javascript class (with or without constructor)
* a function style JavaScript "class" (with or without constructor)
* a factory style Javascript construct (means a function that returns a singleton or instance)

You can also have a look into the test directory to see the different styles I tested with.

## What is possible with this library

The great bthreads library provides a message based way to establich communication via method calls and events from a "parent" to a "worker". The worker can be "worker_threads" (starting nodejs 10.5 as experimental/11.7 as stable feature) or via child_process fork mechanism.
The wrapper is build around this messaging possibility to wrap the complete objects.

In fact you replace the normal require command by the factory method of this library and define the location of the JavaScript file to execute in the worker thread. The result is an object or a factory function depending on the parameters you have provided.
You can locally use the object as you normally would. If it is a singleton style object you can use it directly or call the constructor using "new" to create an instance of the object.

The library will forward all those calls (constructors and also all other method/function calls) including the arguments you provided to the worker process and apply the same there on that object. The results are send back to the parent thread and are returned. For results also returned Promises are detected and fullfills/rejects are also catched and returned.

**Here the only important compatibility issue comes up: All results are provided asynchronously as Promise or async/await because of the fact that the communication to the worker is asynchronous. So this is the only thing where you local object may behave different if it is not based on Promises.**

Additionally to method/function calls the library also supports to forward and receive Events via EventEmitter. This means that Events can be emitted by the parent and are fired on the worker instance of the object and also can be fired by the worker and subscribed/received by the parent. Here the asynchronous topic is not existing because events don't care about that.

## Example

You can have a look at the different class files in the test directory. Lets check one example test-class.js . 

Here is how you normally would use it in your code when using a async/await pattern (very simply example):

```javascript
(async () => {
    const MyClass = require('./test/test-class.js');

    // Create instance
    const myClass = new MyClass('data1', 'data2');
    
    // Register an event (fired by getData1)
    myClass.on('ready', (a1, a2, a3) => {
        console.log('EVENT RECEIVED ' + a1 + ',' + a2 + ',' + a3);
    
        // Fire event
        myClass.emit('setData1', 'new1');
    });
    
    console.log('getData1: ' + await myClass.getData1Async());
})().catch(error => {
    console.log(error)
});
```

Now let's say you want to have the logic of the object running as a separate process or worker_thread, so here this library comes into the game.
You only need to exchange the very first line (the require) by e.g.

```javascript
const BW = require('bthreads-wrapper');
const path = require('path');

// Initialize Wrapped version of test-class (ES6 Class or function style)
const MyClass = BW.getWorkerClass({
    workerFileName: path.join(__dirname, 'test', 'test-class.js'), // we need absolute path!
    proxyEvents: true
});

```

The rest of your code stays exactly the same and works the same.

## API
As you could see in the above example the library basically only offers one factory method to get a wrapped interpretation of you class and one special function to destroy the worker.

### bthreads-wrapper.getWorkerClass(options)

Supported keys in options are:

* **workerFileName**: String, required, Absolute path to the Javascript file to include. The file needs to return a factory function, or an object
* **proxyEvents**: Boolean, optional, Set to true if also Events should be proxied between parent and worker, default value: false
* **returnsFactoryFunction**: Boolean, optional, Needs to be set to true if a factory function is returned because this can not be autodetected that easiely. Factory function means: a function is returned (only one) that, after called with or without parameters return an instance of the real object (whatever real object under the hood)
* **workerBackend**: String, optional, Lets you choose the worker backend to use. Default is to use nodejs worker_threads if available, else child_process. The allowed options are:
  * 'child_process' - spawn a new process as worker
  * 'worker_threads' - use worker_threads (nodejs >10.5 experimental, >11.7 stable)
  * 'direct_require' - directly require the file locally. **Important: No __destructWrapped method is available!!**
  * 'vm2' - evaluate the file in a vm2 context locally. **Important: No __destructWrapped method is available!!**

### WrappedObject.__destructWrapped()
This is a specially defined method name that exists on the object and can be called to destroy the worker. The object renders unusable after this so do not use it afterwards!

## Status of this work
Basically it is in experimental state right now and was a prove of concept ... let's see how it continues :-)

## Credits
This library is based on the great work of the bthreads library as basis and would had been much harder without this work.

## Version history

### 0.1.0 initial release on npm (soon)


## License

The MIT License (MIT)

Copyright (c) 2019 Apollon77 <iobroker@fischer-ka.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

