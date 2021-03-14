'use strict';

const Logger = require('../../helper/logger.js');

const moment = require('moment');

const timeout = (ms) => new Promise((res) => setTimeout(res, ms));

class SmarthomeOutletAccessory {

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
    
    let service = this.accessory.getService(this.api.hap.Service.Outlet);
    let serviceOld = this.accessory.getService(this.api.hap.Service.Switch);
    
    if(serviceOld){
      Logger.info('Removing Switch service', this.accessory.displayName);
      this.accessory.removeService(serviceOld);
    }
        
    if(!service){
      Logger.info('Adding Outlet service', this.accessory.displayName);
      service = this.accessory.addService(this.api.hap.Service.Outlet, this.accessory.displayName, this.accessory.context.config.subtype);
    }
    
    if(!service.testCharacteristic(this.api.hap.Characteristic.CurrentConsumption))
      service.addCharacteristic(this.api.hap.Characteristic.CurrentConsumption);
        
    if(!service.testCharacteristic(this.api.hap.Characteristic.TotalConsumption))
      service.addCharacteristic(this.api.hap.Characteristic.TotalConsumption);
      
    if(!service.testCharacteristic(this.api.hap.Characteristic.Volts))
      service.addCharacteristic(this.api.hap.Characteristic.Volts);
      
    if(!service.testCharacteristic(this.api.hap.Characteristic.Amperes))
      service.addCharacteristic(this.api.hap.Characteristic.Amperes);
      
    if(!service.testCharacteristic(this.api.hap.Characteristic.ResetTotal))
      service.addCharacteristic(this.api.hap.Characteristic.ResetTotal);
  
    this.historyService = new this.FakeGatoHistoryService('energy', this.accessory, {storage:'fs', path: this.api.user.storagePath() + '/fritzbox/', disableTimer:true});
    
    await timeout(250); //wait for historyService to load
    
    service.getCharacteristic(this.api.hap.Characteristic.CurrentConsumption)
      .on('change', this.handler.change.bind(this, this.accessory, this.accessory.context.config.subtype, this.accessory.displayName, this.historyService));
    
    service.getCharacteristic(this.api.hap.Characteristic.ResetTotal)
      .on('set', (value,callback) => {
       
        Logger.info('Resetting FakeGato..', this.accessory.displayName);
        
        const now = Math.round(new Date().valueOf() / 1000); 
        const epoch = Math.round(new Date('2001-01-01T00:00:00Z').valueOf() / 1000);
        
        service.getCharacteristic(this.api.hap.Characteristic.ResetTotal)
          .updateValue(now - epoch);
  
        service.getCharacteristic(this.api.hap.Characteristic.TotalConsumption)
          .updateValue(0);
      
        callback(null);
    
      });
    
    if(this.accessory.context.polling.timer && (!this.accessory.context.polling.exclude.includes(this.accessory.context.config.type) && !this.accessory.context.polling.exclude.includes(this.accessory.context.config.subtype) && !this.accessory.context.polling.exclude.includes(this.accessory.displayName))){

      if(!this.accessory.context.config.readOnly){
  
        service.getCharacteristic(this.api.hap.Characteristic.On)
          .on('set', this.handler.set.bind(this, this.accessory, this.api.hap.Service.Outlet, this.api.hap.Characteristic.On, this.accessory.context.config.subtype, this.accessory.context.config.options));
  
      } else {
  
        service.getCharacteristic(this.api.hap.Characteristic.On)
          .on('set', (state, callback) => {
          
            Logger.info('Can not be switched ' + (state ? 'ON' : 'OFF') + ' - "readOnly" is active!', this.accessory.displayName);
          
            setTimeout(() => {
            
              service
                .getCharacteristic(this.api.hap.Characteristic.On)
                .updateValue(!state);
            
            }, 1000);
            
            callback(null);
          
          });
  
      }
 
    } else {
    
      if(!this.accessory.context.config.readOnly){
   
        service.getCharacteristic(this.api.hap.Characteristic.On)
          .on('get', this.handler.get.bind(this, this.accessory, this.api.hap.Service.Outlet, this.api.hap.Characteristic.On, this.accessory.context.config.subtype, this.accessory.context.config.options))
          .on('set', this.handler.set.bind(this, this.accessory, this.api.hap.Service.Outlet, this.api.hap.Characteristic.On, this.accessory.context.config.subtype, this.accessory.context.config.options));
   
      } else {
      
        service.getCharacteristic(this.api.hap.Characteristic.On)
          .on('get', this.handler.get.bind(this, this.accessory, this.api.hap.Service.Outlet, this.api.hap.Characteristic.On, this.accessory.context.config.subtype, this.accessory.context.config.options))
          .on('set', (state, callback) => {
          
            Logger.info('Can not be switched ' + (state ? 'ON' : 'OFF') + ' - "readOnly" is active!', this.accessory.displayName);
          
            setTimeout(() => {
            
              service
                .getCharacteristic(this.api.hap.Characteristic.On)
                .updateValue(!state);
            
            }, 1000);
            
            callback(null);
          
          });
   
      }
 
    }
    
    this.refreshHistory(service);
    
  }
  
  async refreshHistory(service){ 
    
    let state = service.getCharacteristic(this.api.hap.Characteristic.CurrentConsumption).value;
    
    this.historyService.addEntry({
      time: moment().unix(), 
      power: state || 0
    });
    
    setTimeout(() => {
      this.refreshHistory(service);
    }, 10 * 60 * 1000);
    
  }

}

module.exports = SmarthomeOutletAccessory;