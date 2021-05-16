'use strict';

const Logger = require('../../helper/logger.js');

const moment = require('moment');

const timeout = (ms) => new Promise((res) => setTimeout(res, ms));

class SmarthomeTemperatureAccessory {
  constructor(api, accessory, handler, FakeGatoHistoryService) {
    this.api = api;
    this.accessory = accessory;
    this.FakeGatoHistoryService = FakeGatoHistoryService;

    this.handler = handler;

    this.getService();
  }

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // Services
  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  async getService() {
    let service = this.accessory.getService(this.api.hap.Service.TemperatureSensor);

    if (!service) {
      Logger.info('Adding Temperature service', this.accessory.displayName);
      service = this.accessory.addService(
        this.api.hap.Service.TemperatureSensor,
        this.accessory.displayName,
        this.accessory.context.config.subtype
      );
    }

    service.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature).setProps({
      minValue: -100,
      maxValue: 100,
    });

    if (this.accessory.context.config.battery) {
      let batteryService = this.accessory.getService(this.api.hap.Service.BatteryService);

      if (!batteryService) {
        Logger.info('Adding Battery service', this.accessory.displayName);
        batteryService = this.accessory.addService(this.api.hap.Service.BatteryService);
      }

      batteryService.setCharacteristic(
        this.api.hap.Characteristic.ChargingState,
        this.api.hap.Characteristic.ChargingState.NOT_CHARGEABLE
      );
    } else {
      if (this.accessory.getService(this.api.hap.Service.BatteryService))
        this.accessory.removeService(this.accessory.getService(this.api.hap.Service.BatteryService));
    }

    if (this.accessory.context.config.humidity) {
      let humidityService = this.accessory.getService(this.api.hap.Service.HumiditySensor);

      if (!humidityService) {
        Logger.info('Adding Humidity service', this.accessory.displayName);
        humidityService = this.accessory.addService(this.api.hap.Service.HumiditySensor);
      }
    } else {
      if (this.accessory.getService(this.api.hap.Service.HumiditySensor))
        this.accessory.removeService(this.accessory.getService(this.api.hap.Service.HumiditySensor));
    }

    this.historyService = new this.FakeGatoHistoryService('room', this.accessory, {
      storage: 'fs',
      path: this.api.user.storagePath() + '/fritzbox/',
      disableTimer: true,
    });

    await timeout(250); //wait for historyService to load

    if (
      this.accessory.context.polling.timer &&
      !this.accessory.context.polling.exclude.includes(this.accessory.context.config.type) &&
      !this.accessory.context.polling.exclude.includes(this.accessory.context.config.subtype) &&
      !this.accessory.context.polling.exclude.includes(this.accessory.displayName)
    ) {
      service
        .getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
        .on(
          'change',
          this.handler.change.bind(
            this,
            this.accessory,
            'smarthome-temperature',
            this.accessory.displayName,
            this.historyService
          )
        );
    } else {
      service
        .getCharacteristic(this.api.hap.Characteristic.CurrentTemperature)
        .on(
          'get',
          this.handler.get.bind(
            this,
            this.accessory,
            this.api.hap.Service.TemperatureSensor,
            this.api.hap.Characteristic.CurrentTemperature,
            'smarthome-temperature',
            this.accessory.context.config.options
          )
        )
        .on(
          'change',
          this.handler.change.bind(
            this,
            this.accessory,
            'smarthome-temperature',
            this.accessory.displayName,
            this.historyService
          )
        );
    }

    this.refreshHistory(service);
  }

  async refreshHistory(service) {
    let state = service.getCharacteristic(this.api.hap.Characteristic.CurrentTemperature).value;

    this.historyService.addEntry({
      time: moment().unix(),
      temp: state,
      humidity: 0,
      ppm: 0,
    });

    setTimeout(() => {
      this.refreshHistory(service);
    }, 10 * 60 * 1000);
  }
}

module.exports = SmarthomeTemperatureAccessory;
