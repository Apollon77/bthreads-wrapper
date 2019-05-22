/**
 * This file is always included as a worker.
 *
 * It is then getting it's parent context from the bthreads module and handles all worker-side
 * topics and todos.
 */
const threads = require('bthreads');
const EventEmitter = require('events');

// Reference to the parent process
const {parent} = threads;

let MyClass; // contains the object (prototype) or function (in case of a function based "singleton" structure)
let obj; // contains the object instance once constructed
let methods; // contains the methods allowed to be called on the Object/instance
let workerOptions = {}; // contain the options the worker was initialized with

/**
 * Converts Arguments from an Arguments object into an array
 * @param args Arguments object
 * @returns {Array} Arguments as array
 */
function getArgumentsArray(args) {
    const argArr = [];
    for (let i = 0; i < args.length; i++) argArr.push(args[i]);
    return argArr;
}

/**
 * Collect allowed methods from object instance, object (prototype) and EventEmitter
 * Also needed because ES6 classes and function based instances look slightly different "inside"
 * @returns {boolean}
 */
function registerInstanceMethods() {
    const props = {};
    Object.getOwnPropertyNames(obj).forEach(prop => {
        props[prop] = true;
    });
    Object.getOwnPropertyNames(Object.getPrototypeOf( obj )).forEach(prop => {
        props[prop] = true;
    });
    Object.getOwnPropertyNames(EventEmitter).forEach(prop => {
        props[prop] = true;
    });

    // re-register all methods allowed to call (now bound to the instance) and put them into global object
    methods = {};
    Object.keys(props).forEach(prop => {
        //console.log(`Prop: ${prop}: ${typeof obj[prop]}  /  ${obj.hasOwnProperty(prop)}`);
        if (typeof obj[prop] !== 'function') return; // only care about "methods" (no variable access)
        if (prop.startsWith('_')) return; // handle all methods starting with _ as private and do not alow to be called
        if (prop !== 'constructor') { // constructor handled here, so do not handle again
            methods[prop] = obj[prop].bind(obj);
            //console.log('Register object method ' + prop);
        }
    });

    // If we want to proxy Events we need to catch emits to send them to the parent too
    if (workerOptions.proxyEvents) {
        const oldEmit = obj.emit;
        obj.emit = (...args) => {
            const argArr = getArgumentsArray(args);
            //console.log('WORKER SEND EVENT ' + JSON.stringify(argArr));
            parent.fire('eventCall', [{eventArguments: argArr}]);
            oldEmit.apply(obj, args);
        };
    }
    return true;
}

/**
 * This hook (remote method call) will be called right at the beginning after creation of the worker
 * and handled all initializing tasks on the worker
 *
 * In "options" object the following keys are required:
 * - workerFileName: absolute filename to the object/class/function file to include, required!
 * - proxyEvents: boolean if events should be proxied too or not
 */
parent.hook('initWorker', (options) => {
    workerOptions = options;
    if (!options.workerFileName || typeof options.workerFileName !== 'string') {
        throw Error('No workerFileName set!');
    }
    // require the "prototype"/function as MyClass to check what is all available and use to initialize object if needed
    MyClass = require(options.workerFileName);
    obj = null;

    // If MyClass has a prototype (means it is a ES6 class or a "function style class")
    if (MyClass.prototype) {
        /**
         * Inline function to encapsulate logic to construct and handle a constructed object instance
         */
        function handleConstructorCall() {
            /**
             * Constructs an object with the given arguments
             *
             * Tried a lot, did not found other way that allows to pass parameters to ES6 class correctly.
             * All other ways were not passing arguments correctly or errored on "can not instanciate
             * object without "new" :-(
             *
             * @param constructor Object/Prototype definition
             * @param args array constructor arguments
             * @returns {any} object instance
             */
            function constructObject(constructor, args) {
                var q = [];
                for(var i = 0; i < args.length; i++)
                    q.push("args[" + i + "]");
                return eval("new MyClass(" + q.join(",") + ")");
            }

            //console.log('constructor called ' + JSON.stringify(arguments));

            // get Object instance and assign to obj variable
            obj = constructObject(MyClass, arguments);

            registerInstanceMethods(obj);

            return true;
        }

        // Initially register all Object methods from prototype to be allowed to call
        methods = {};
        Object.getOwnPropertyNames(MyClass.prototype).forEach(prop => {
            //console.log(`Prop: ${prop}: ${typeof MyClass[prop]}  /  ${MyClass.hasOwnProperty(prop)}  / ${JSON.stringify(Object.getOwnPropertyDescriptor(MyClass, prop))}`);
            if (typeof MyClass[prop] !== 'function') return; // only care about "methods" (no variable access)
            if (prop.startsWith('_')) return; // handle all methods starting with _ as private and do not alow to be called
            if (prop === 'constructor') { // When constructor is called use above method to construct the object, else direct
                methods[prop] = handleConstructorCall;
            }
            else {
                methods[prop] = MyClass[prop];
            }
            //console.log('register method from Object prototype ' + prop);
        });

    }
    // No prototype so we get the properties from the class itself
    else {
        methods = {};
        Object.getOwnPropertyNames(MyClass).forEach(prop => {
            console.log(`Prop: ${prop}: ${typeof MyClass[prop]}  /  ${MyClass.hasOwnProperty(prop)}  / ${JSON.stringify(Object.getOwnPropertyDescriptor(MyClass, prop))}`);
            if (typeof MyClass[prop] !== 'function') return; // only care about "methods" (no variable access)
            if (prop.startsWith('_')) return; // handle all methods starting with _ as private and do not alow to be called

            methods[prop] = MyClass[prop];

            console.log('register method from required function style structure ' + prop);
        });

    }
    return true;
});

/**
 * This hook (remote method call) will be called for any method call initiated on the parent proxied object.
 * The parameters in the calling object are:
 * - methodName: Name of the method to call
 * - methodParams: arguments of the methodcall
 * - methodMetaData: additional details on the method call and the type of the parameters
 *                   currently "function" gets a special handling on calls
 */
parent.hook('methodCall', async (callDetails) => {
    //console.log('CALL METHOD ' + callDetails.methodName + ' - ' + JSON.stringify(methods));
    // emit call means that an event should be emitted; needs special logic
    if (callDetails.methodName === 'emit') {
        if (!workerOptions.proxyEvents) return {result: null, error: null}; // Should not happen, but to be safe
        if (!obj) return {result: null, error: null}; // Should not happen, but to be safe
        //console.log('CALL EVENT ' + callDetails.methodName + ' = ' + JSON.stringify(callDetails.methodParams));

        // Search registered callbacks for events and call them directly, using emit is a pain because we also catched all emits above
        const eventName = callDetails.methodParams.shift();
        if (obj._events[eventName]) {
            if (typeof obj._events[eventName] === 'function') {
                //console.log('WORKER EVENT CALLBACK ' + eventName + ' = ' + JSON.stringify(callDetails.methodParams));
                obj._events[eventName].apply(obj, callDetails.methodParams);
            }
            else if (Array.isArray(obj._events[eventName])) {
                obj._events[eventName].forEach(event => {
                    //console.log('WORKER EVENTS CALLBACK ' + eventName + ' = ' + JSON.stringify(callDetails.methodParams));
                    event.apply(obj, callDetails.methodParams);
                });
            }
        }
        else {
            //console.log('WORKER EVENT NOT FOUND ' + eventName);
        }

        return {result: null, error: null}; // events do not really have a return value
    }
    else if (callDetails.methodName === '__factoryFunction') {
        console.log('INITIALIZE FACTORY FUNCTION');
        if (typeof MyClass !== 'function') {
            return {result: null, error: 'Factory function expected but ' + typeof MyClass + ' found'};
        }
        obj = MyClass.apply(null, callDetails.methodParams);

        registerInstanceMethods(obj);

        return {result: true, error: null};
    }
    // Handle method calls for registered methods and catch result
    else if (methods[callDetails.methodName] !== undefined) {
        const resultMetaData = [];
        // check all call arguments and simulate functions to catch the response parameters
        for (let i = 0; i < callDetails.methodParams.length; i++) {
            const functionIndex = i;
            if (callDetails.methodMetaData[functionIndex] === 'function' && callDetails.methodParams[functionIndex] === null) {
                callDetails.methodParams[functionIndex] = (...args) => {
                    const argArr = getArgumentsArray(args);

                    //console.log('CATCH Callback index ' + functionIndex + ' = ' + JSON.stringify(argArr));
                    resultMetaData.push({parameterIndex: functionIndex, type: 'function', parameterData: argArr});
                }
            }
        }
        // Now call the method with the parameters
        const result = methods[callDetails.methodName].apply(obj, callDetails.methodParams);

        // Our response is a Promise, resolve and catch result
        if (result instanceof Promise) {
            //console.log('RESULT IS A PROMISE');

            const realRes = await new Promise((resolve, _reject) => {
                result.then((...args) => {
                    const argArr = getArgumentsArray(args);

                    //console.log('CATCH Promise fullfilled = ' + JSON.stringify(argArr));
                    resultMetaData.push({promiseResult: 'fullfilled', type: 'Promise', parameterData: argArr});

                    //console.log('RESULT PROMISE METHOD ' + JSON.stringify(result) + ' with meta ' + JSON.stringify(resultMetaData));
                    resolve({result: null, error: null, resultMetaData: resultMetaData});
                }, (...args) => {
                    const argArr = getArgumentsArray(args);

                    //console.log('CATCH Promise rejexted = ' + JSON.stringify(argArr));
                    resultMetaData.push({promiseResult: 'rejected', type: 'Promise', parameterData: argArr});

                    //console.log('RESULT PROMISE METHOD ' + JSON.stringify(result) + ' with meta ' + JSON.stringify(resultMetaData));
                    resolve({result: null, error: null, resultMetaData: resultMetaData});
                });
            });
            //console.log('RESULT PROMISE METHOD FINAL ' + JSON.stringify(realRes));
            return realRes;
        }
        // and for normal methods directly use the result
        else {
            console.log('RESULT METHOD ' + JSON.stringify(result) + ' with meta ' + JSON.stringify(resultMetaData));
            return {result: result, error: null, resultMetaData: resultMetaData};
        }
    }
    else {
        return {result: null, error: 'Method ' + callDetails.methodName + ' not defined'};
    }
});
