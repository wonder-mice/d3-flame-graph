const data = [{
    n: 'Mail', v: 450, d: 0, c: [{
        n: 'start', v: 350, d: 0, c: [{
            n: 'static_initializers', v: 50, d: 0
        }, {
            n: 'main', v: 300, d: 0, c: [{
                n: 'ApplicationMain', v: 300, d: 0, c: [{
                    n: 'ApplicationInit', v: 100, d: 0
                }, {
                    n: 'ApplicationRun', v: 200, d: 0, c: [{
                        n: 'event_loop', v: 195, d: 0
                    }]
                }]
            }]
        }]
    }, {
        n: 'thread_run', v: 100, d: 0, c: [{
            n: 'hid', v: 80, d: 0
        }, {
            n: 'async_ipc', v: 20, d: 0
        }]
    }]
}, {
    n: 'Calendar', v: 400, d: 0, c: [{
        n: 'start', v: 350, d: 0, c: [{
            n: 'static_initializers', v: 50, d: 0
        }, {
            n: 'main', v: 300, d: 0, c: [{
                n: 'ApplicationMain', v: 300, d: 0, c: [{
                    n: 'ApplicationInit', v: 100, d: 0
                }, {
                    n: 'ApplicationRun', v: 200, d: 0, c: [{
                        n: 'event_loop', v: 195, d: 0
                    }]
                }]
            }]
        }]
    }]
}, {
    n: 'Maps', v: 350, d: 0
}, {
    n: 'Photos', v: 300, d: 0
}, {
    n: 'Music', v: 250, d: 0
}, {
    n: 'Camera', v: 250, d: 0
}, {
    n: 'Clock', v: 200, d: 0
}, {
    n: 'Preferences', v: 150, d: 0
}, {
    n: 'kernel', v: 50, d: 0
}]