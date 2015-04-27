var logging = exports;

logging.level = {
    DEBUG: 5,
    INFO: 10,
    WARNING: 15,
    ERROR: 20,
    CRITICAL: 25
};

logging.setLevel = function(level) {
    _level = level;
};

logging.setFn = function(fn) {
    _loggingFn = fn;
};

logging.setFormatter = function(formatter) {
    _formatter = formatter;
};

logging.stylize = true;

logging.styles = {
    //styles
    'bold'      : ['\033[1m',  '\033[22m'],
    'italic'    : ['\033[3m',  '\033[23m'],
    'underline' : ['\033[4m',  '\033[24m'],
    'inverse'   : ['\033[7m',  '\033[27m'],
    //grayscale
    'white'     : ['\033[37m', '\033[39m'],
    'grey'      : ['\033[90m', '\033[39m'],
    'black'     : ['\033[30m', '\033[39m'],
    //colors
    'blue'      : ['\033[34m', '\033[39m'],
    'cyan'      : ['\033[36m', '\033[39m'],
    'green'     : ['\033[32m', '\033[39m'],
    'magenta'   : ['\033[35m', '\033[39m'],
    'red'       : ['\033[31m', '\033[39m'],
    'yellow'    : ['\033[33m', '\033[39m'],
    //logging levels
    'DEBUG'     : ['\033[34m', '\033[39m'],
    'INFO'      : ['\033[32m', '\033[39m'],
    'WARNING'   : ['\033[35m', '\033[39m'],
    'ERROR'     : ['\033[31m', '\033[39m'],
    'CRITICAL'  : ['\033[31m\033[1m', '\033[22m\033[39m']
};

logging.formatters = {
    time: function() {
        var date = new Date();
        var timezoneOffset = -date.getTimezoneOffset() / 60;
        if (timezoneOffset < 0) timezoneOffset = "" + timezoneOffset;
        else timezoneOffset = "+" + timezoneOffset;

        return [
            ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()], ' ',
            date.getFullYear(), '-', addZero(2, date.getMonth() + 1), '-', addZero(2, date.getDate()),
            ' ', addZero(2, date.getHours()), ':', addZero(2, date.getMinutes()), ':', addZero(2, date.getSeconds()), '.',
            addZero(3, date.getMilliseconds()), ' GMT', timezoneOffset
        ].join('');
    },

    level: function(lv) {
        if (lv in _levelsMap) {
            return _levelsMap[lv];
        }

        for (var i in logging.level) {
            _levelsMap[logging.level[i]] = i;

            if (lv in _levelsMap) {
                return _levelsMap[lv];
            }
        }

        return 'UNKNOWN';
    },

    highlight: function(text) {
        return logging.formatters.style(text, text);
    },

    style: function(st, text) {
        if (!logging.stylize || !(st in logging.styles)) {
            return text;
        }

        return logging.styles[st][0] + text + logging.styles[st][1];
    },

    prettyPrint: function(data) {
        if (typeof data !== 'object') {
            return logging.formatters.style('white', data.toString());
        }

        if (data == null) {
            return logging.formatters.style('white', 'null');
        }

        if ('length' in data) {
            return logging.formatters.style('white', '[' + data.toString() + ']');
        }

        var rows = [];

        Object.keys(data).forEach(function(key) {
            var value;

            if (data[key] === null) {
                value = logging.formatters.style('grey', 'null');
            } else if (typeof data[key] === 'undefined') {
                value = logging.formatters.style('grey', 'undefined');
            } else {
                value = data[key].toString();
            }

            rows.push(logging.formatters.style('white', key) + ': ' + value);
        });

        return '{\n' + rows.join(',\n') + '\n}\n';
    },

    timeDiff: function(number) {
        return logging.formatters.style('yellow', number + 'ms');
    }

};

logging.debug = function(msg, trace) {
    log(logging.level.DEBUG, msg, (trace == undefined)? false : trace);
};

logging.info = function(msg, trace) {
    log(logging.level.INFO, msg, (trace == undefined)? false : trace);
};

logging.warning = function(msg, trace) {
    log(logging.level.WARNING, msg, (trace == undefined)? false : trace);
};

logging.error = function(msg, trace) {
    log(logging.level.ERROR, msg, (trace == undefined)? true : trace);
};

logging.critical = function(msg, trace) {
    log(logging.level.CRITICAL, msg, (trace == undefined)? true : trace);
};

logging.middleware = function(request, response, next) {
    var startTime = (new Date()).getTime();
    var userMessages = [];

    request.log = {
        startTimer: function(name) {
            if (logging.level.DEBUG < _level) {
                request.log['end' + ucfirst(name)] = function() {};
                return;
            }

            var time = (new Date()).getTime();

            request.log['end' + ucfirst(name)] = function(message) {
                var start = time - startTime;
                var end = (new Date()).getTime() - startTime;
                time = (new Date()).getTime() - time;
                userMessages.push(('(' + logging.formatters.timeDiff(start) + ' -> ' + logging.formatters.timeDiff(end) + ')') + 
                        ' ' + logging.formatters.style('green', message.toString()) + ' ' +
                        '(took ' + logging.formatters.timeDiff(time) + ')');
            };
        },

        push: function(message) {
            var start = (new Date()).getTime() - startTime;
            userMessages.push(('(' + logging.formatters.timeDiff(start) + ')') + ' ' + 
                logging.formatters.style('green', message.toString()));
        }
    };

    response.on('finish', function() {
        var endTime = (new Date()).getTime();
        var log =  logging.formatters.style('red', response.statusCode.toString()) + ' ' +
                logging.formatters.style('yellow', request.method) + ' ' + logging.formatters.timeDiff(endTime - startTime) + ' ' + request.url;

        if (userMessages.length) {
            log += '\nUser messages:\n' + userMessages.join('\n');
        }

        logging.info(log);
    });

    next();
};

var _loggingFn = console.log;
var _level = exports.level.WARNING;
var _formatter = function(level, message) {
    return this.style('grey', '[' + this.time() + '] ') + this.highlight(this.level(level)) + ' ' + this.prettyPrint(message);
};

var _levelsMap = {};

function log(level, message, trace) {
    if (level < _level) {
        return;
    }

    _loggingFn(_formatter.call(logging.formatters, level, message));

    if (trace) {
        console.trace();
    }
}

function ucfirst(string)
{
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function addZero(length, number) {
    var str = number.toString();

    for (var cnt = length - str.length; cnt > 0; --cnt) {
        str = '0' + str;
    }

    return str;
}
