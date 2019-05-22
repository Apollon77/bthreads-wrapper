/**
 * This file is the main class that implements a wrapper around bthrads worker classes
 */
const threads = require('bthreads');
const path = require('path');
const EventEmitter = require('events');

if (!threads.isMainThread) {
    throw Error('This file should not be used in a worker environment');
}

/**
 * Main method of the wrapper called to initialize a wrapped object
 * @param options Object with settings for the wrapper:
 *                - workerFileName string required Filename of the worker file to use
 *                - proxyEvents boolean, default false should event be proxied too?
 *                - returnsFactoryFunction boolean, default false, set to true if Wrapped file returns a factory
 *                  function instead of an object or instance
 * @returns {BThreadsWrapper} object instance to use as wrapper
 */
function getWorkerClass(options) {
    let wrappedObject;

    if (typeof options === 'string') {
        options = {workerFileName: options};
    }

    //console.log(threads.backend);
    // initialize bthreads Thread with our Worker file
    const thread = new threads.Thread(path.join(__dirname, 'worker.js'));

    // We will return an instance of this object at the end
    class BThreadsWrapper extends EventEmitter {
        /**
         * Constructor that will return a Proxy Object once we want an instance
         * @returns {BThreadsWrapper}
         */
        constructor() {
            super();
            //console.log('CONSTRUCT');

            // get list of EventEmitter methods because they are not available as direct properties
            const eventProps = Object.getOwnPropertyNames(EventEmitter.prototype);

            // Proxy Handler that handles an instance
            let handler = {
                // catch all method calls on the object to handle them
                get: function(target, propKey, _receiver) {
                    // console.log('GET-I ' + propKey);
                    // User called an existing method or EventEmitter method except "emit" then call local method
                    if (propKey !== 'emit' && (target[propKey] || eventProps.includes(propKey))) {
                        //console.log('RETURN LOCAL FOR ' + propKey);
                        return target[propKey];
                    }
                    // User called special Wrapper-destruction method to end the Thread
                    else if (propKey === '__destructWrapped') {
                        return () => {
                            thread.close();
                        }
                    }
                    // All other method calls are proxies to the remote object
                    return async (...args) => {
                        // Prepare call arguments, collect meta data and handle function arguments
                        const callParameterMetaData = [];
                        const transferArgs = [];
                        for (let i = 0; i < args.length; i++) {
                            callParameterMetaData.push(typeof args[i]);
                            if (typeof args[i] === 'function') {
                                transferArgs[i] = null;
                            }
                            else {
                                transferArgs[i] = args[i];
                            }
                        }

                        //console.log('WRAPPER GET ' + propKey + JSON.stringify(transferArgs) + ' with meta ' + JSON.stringify(callParameterMetaData));
                        // Send remote call
                        const res = await thread.call('methodCall', [{methodName: propKey, methodParams: transferArgs, methodMetaData: callParameterMetaData}]);
                        //console.log('WRAPPER RESULT ' + JSON.stringify(res));

                        // If an error is returned throw it
                        if (res.error) {
                            throw new Error(res.error);
                        }

                        // If special Metadata are returned handle them to restore functions and Promises
                        if (res.resultMetaData && res.resultMetaData.length) {
                            res.resultMetaData.forEach((resEntry) => {
                                if (!resEntry) return;
                                if (resEntry.parameterIndex !== undefined) {
                                    //console.log('WRAPPER CALL CALLBACK ' + resEntry.parameterIndex + ' with ' + JSON.stringify(resEntry.parameterData));
                                    args[resEntry.parameterIndex].apply(null, resEntry.parameterData);
                                }
                                if (resEntry.promiseResult !== undefined) {
                                    res.result = new Promise((resolve, reject) => {
                                        if (resEntry.promiseResult === 'fullfilled') {
                                            //console.log('RESOLVE-LOCALLY');
                                            resolve.apply(null, resEntry.parameterData);
                                        }
                                        else {
                                            //console.log('REJECT-LOCALLY');
                                            reject.apply(null, resEntry.parameterData);
                                        }
                                    });
                                }
                            });
                        }
                        return res.result;
                    };
                }
            };

            wrappedObject = new Proxy(this, handler);
            return wrappedObject;
        }
    }

    /**
     * Receive events send by the Worker to the Parent and emit them locally directly.
     * Only works if we have an instance!
     */
    thread.bind('eventCall', (callDetails) => {
        if (!wrappedObject) return;
        //console.log('PARENT RECEIVED EVENT ' + JSON.stringify(callDetails.eventArguments));
        const eventName = callDetails.eventArguments.shift();
        if (wrappedObject._events[eventName]) {
            if (typeof wrappedObject._events[eventName] === 'function') {
                //console.log('PARENT EVENT CALLBACK ' + eventName + ' = ' + JSON.stringify(callDetails.eventArguments));
                wrappedObject._events[eventName].apply(wrappedObject, callDetails.eventArguments);
            }
            else if (Array.isArray(wrappedObject._events[eventName])) {
                wrappedObject._events[eventName].forEach(event => {
                    //console.log('PARENT EVENTS CALLBACK ' + eventName + ' = ' + JSON.stringify(callDetails.eventArguments));
                    event.apply(wrappedObject, callDetails.eventArguments);
                });
            }
        }
        else {
            //console.log('PARENT EVENT NOT FOUND ' + eventName);
        }
    });

    // Initialize Worker object
    thread.call('initWorker', [options]).then((_result) => {
        //console.log(result);
    }, (error) => {
        throw new Error(error);
    });

    if (options.returnsFactoryFunction) {
        return function (...args) {
            //console.log('GET ' + propKey + JSON.stringify(args) + ' with meta ' + JSON.stringify(callParameterMetaData));
            // Send remote call
            thread.call('methodCall', [{methodName: '__factoryFunction', methodParams: args}]).then((_result) => {
                //console.log(result);
            }, (error) => {
                throw new Error(error);
            });
            //console.log('WRAPPER RESULT ' + JSON.stringify(res));

            return new BThreadsWrapper();
        }
    }

    // Proxy Handler for a normal Object, is handling constructor call too
    let handler = {
        // handles constructor call and basically create instance of object above
        construct: function(target, args) {
            //console.log('Wrapper constructor called');
            // Prepare call arguments, collect meta data and handle function arguments
            const callParameterMetaData = [];
            for (let i = 0; i < args.length; i++) {
                callParameterMetaData.push(typeof args[i]);
                if (typeof args[i] === 'function') {
                    args[i] = null;
                }
            }
            // TODO: find better way to get constructor synchronous somehow ...
            thread.call('methodCall', [{methodName: 'constructor', methodParams: args, methodMetaData: callParameterMetaData}]).then((_result) => {
                //console.log('construct result: ' + result);
            }, (error) => {
                throw new Error (error);
            });

            // Create instance
            return new target(...args);
        },

        // catch all method calls on the object to handle them
        get: function(target, propKey, _receiver) {
            //console.log('GET-O ' + propKey);
            if (propKey === '__destructWrapped') {
                return () => {
                    thread.close();
                }
            }
            // All other method calls are proxies to the remote object
            return async function (...args) {
                // Prepare call arguments, collect meta data and handle function arguments
                const callParameterMetaData = [];
                const transferArgs = [];
                for (let i = 0; i < args.length; i++) {
                    callParameterMetaData.push(typeof args[i]);
                    if (typeof args[i] === 'function') {
                        transferArgs[i] = null;
                    }
                    else {
                        transferArgs[i] = args[i];
                    }
                }

                //console.log('GET ' + propKey + JSON.stringify(transferArgs) + ' with meta ' + JSON.stringify(callParameterMetaData));
                // Send remote call
                const res = await thread.call('methodCall', [{methodName: propKey, methodParams: transferArgs, methodMetaData: callParameterMetaData}]);
                //console.log('WRAPPER RESULT ' + JSON.stringify(res));

                // If an error is returned throw it
                if (res.error) {
                    throw new Error(res.error);
                }

                // If special Metadata are returned handle them to restore functions and Promises
                if (res.resultMetaData && res.resultMetaData.length) {
                    res.resultMetaData.forEach((resEntry) => {
                        if (!resEntry) return;
                        if (resEntry.parameterIndex !== undefined) {
                            //console.log('WRAPPER CALL CALLBACK ' + resEntry.parameterIndex + ' with ' + JSON.stringify(resEntry.parameterData));
                            args[resEntry.parameterIndex].apply(null, resEntry.parameterData);
                        }
                        if (resEntry.promiseResult !== undefined) {
                            res.result = new Promise((resolve, reject) => {
                                if (resEntry.promiseResult === 'fullfilled') {
                                    //console.log('RESOLVE-LOCALLY');
                                    resolve.apply(null, resEntry.parameterData);
                                }
                                else {
                                    //console.log('REJECT-LOCALLY');
                                    reject.apply(null, resEntry.parameterData);
                                }
                            });
                        }
                    });
                }
                return res.result;
            };
        }
    };

    return new Proxy(BThreadsWrapper, handler);
}

// Export the main method
module.exports = {
    getWorkerClass: getWorkerClass
}

