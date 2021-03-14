'use strict';

const Logger = require('../../helper/logger.js');

const moment = require('moment');

const timeout = (ms) => new Promise((res) => setTimeout(res, ms));

class SmarthomeWindowAccessory {

  constructor (api, accessory, handler, FakeGatoHistoryService) {
    
    this.api = api;
    this.accessory = accessory;
    this.FakeGatoHistoryService = FakeGatoHistoryService;
    
    this.handler = handler;
    
    this.getService();

  }

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // Services
  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  async getService () {
    
    let service = this.accessory.getService(this.api.hap.Service.ContactSensor);
    
    if(!service){
      Logger.info('Adding Window service', this.accessory.displayName);
      service = this.accessory.addService(this.api.hap.Service.ContactSensor, this.accessory.displayName, this.accessory.context.config.subtype);
    }
    
    if(this.accessory.context.config.battery){
      
      let batteryService = this.accessory.getService(this.api.hap.Service.BatteryService);
      
      if(!batteryService){
        Logger.info('Adding Battery service', this.accessory.displayName);
        batteryService = this.accessory.addService(this.api.hap.Service.BatteryService);
      }
      
      batteryService
        .setCharacteristic(this.api.hap.Characteristic.ChargingState, this.api.hap.Characteristic.ChargingState.NOT_CHARGEABLE);
      
    } else {
    
      if(this.accessory.getService(this.api.hap.Service.BatteryService))
        this.accessory.removeService(this.accessory.getService(this.api.hap.Service.BatteryService));
    
    }
    
    if (!service.testCharacteristic(this.api.hap.Characteristic.LastActivation))
      service.addCharacteristic(this.api.hap.Characteristic.LastActivation);
    
    if (!service.testCharacteristic(this.api.hap.Characteristic.TimesOpened))
      service.addCharacteristic(this.api.hap.Characteristic.TimesOpened);

    if (!service.testCharacteristic(this.api.hap.Characteristic.ResetTotal))
      service.addCharacteristic(this.api.hap.Characteristic.ResetTotal);   
    
    if (!service.testCharacteristic(this.api.hap.Characteristic.OpenDuration))
      service.addCharacteristic(this.api.hap.Characteristic.OpenDuration);
    
    if (!service.testCharacteristic(this.api.hap.Characteristic.ClosedDuration))
      service.addCharacteristic(this.api.hap.Characteristic.ClosedDuration);
    
    service.getCharacteristic(this.api.hap.Characteristic.ResetTotal)
      .on('set', (value,callback) => {
       
        Logger.info('Resetting FakeGato..', this.accessory.displayName);
        
        const now = Math.round(new Date().valueOf() / 1000); 
        const epoch = Math.round(new Date('2001-01-01T00:00:00Z').valueOf() / 1000);
        
        service.getCharacteristic(this.api.hap.Characteristic.ResetTotal)
          .updateValue(now - epoch);
  
        this.accessory.context.timesOpened = 0;
  
        service.getCharacteristic(this.api.hap.Characteristic.TimesOpened)
          .updateValue(this.accessory.context.timesOpened);
      
        callback(null);
      });
    
    this.historyService = new this.FakeGatoHistoryService('door', this.accessory, {storage:'fs', path: this.api.user.storagePath() + '/fritzbox/', disableTimer:true}); 
    
    await timeout(250); //wait for historyService to load
    
    if(this.accessory.context.polling.timer && (!this.accessory.context.polling.exclude.includes(this.accessory.context.config.type) && !this.accessory.context.polling.exclude.includes(this.accessory.context.config.subtype) && !this.accessory.context.polling.exclude.includes(this.accessory.displayName))){
 
      service.getCharacteristic(this.api.hap.Characteristic.ContactSensorState)
        .on('change', this.handler.change.bind(this, this.accessory, 'smarthome-window', this.accessory.displayName, this.historyService));
 
    } else {
 
      service.getCharacteristic(this.api.hap.Characteristic.ContactSensorState)
        .on('get', this.handler.get.bind(this, this.accessory, this.api.hap.Service.ContactSensor, this.api.hap.Characteristic.ContactSensorState, 'smarthome-window', this.accessory.context.config.options))
        .on('change', this.handler.change.bind(this, this.accessory, 'smarthome-window', this.accessory.displayName, this.historyService));
 
    }
    
    this.refreshHistory(service);
    
  }
  
  async refreshHistory(service){ 
    
    let state = service.getCharacteristic(this.api.hap.Characteristic.ContactSensorState).value;
    
    this.historyService.addEntry({
      time: moment().unix(), 
      status: state ? 1 : 0
    });
    
    setTimeout(() => {
      this.refreshHistory(service);
    }, 10 * 60 * 1000);
    
  }

}

module.exports = SmarthomeWindowAccessory;