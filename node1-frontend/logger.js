const fs = require('fs');
const path = require('path');

class Logger {
  constructor(serviceName) {
    this.serviceName = serviceName;
    this.logFile = path.join(__dirname, `${serviceName}.log`);
  }

  log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] [${this.serviceName}] ${message}\n`;
    
    console.log(logMessage.trim());
    fs.appendFileSync(this.logFile, logMessage);
  }

  info(message) { this.log('INFO', message); }
  error(message) { this.log('ERROR', message); }
  warn(message) { this.log('WARN', message); }
}

module.exports = Logger;