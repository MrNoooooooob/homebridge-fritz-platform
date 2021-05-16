'use strict';

const Logger = require('../../helper/logger.js');

const moment = require('moment');

const timeout = (ms) => new Promise((res) => setTimeout(res, ms));

class PresenceMotionAccessory {
  constructor(api, accessory, handler, accessories, FakeGatoHistoryService) {
    this.api = api;
    this.accessory = accessory;
    this.accessories = accessories;
    this.FakeGatoHistoryService = FakeGatoHistoryService;

    this.handler = handler;

    this.getService();
  }

  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//
  // Services
  //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~//

  async getService() {
    let service = this.accessory.getService(this.api.hap.Service.MotionSensor);
    let serviceOld = this.accessory.getService(this.api.hap.Service.OccupancySensor);

    if (serviceOld) {
      Logger.info('Removing Occupancy service', this.accessory.displayName);
      this.accessory.removeService(serviceOld);
    }

    if (!service) {
      Logger.info('Adding Motion service', this.accessory.displayName);
      service = this.accessory.addService(
        this.api.hap.Service.MotionSensor,
        this.accessory.displayName,
        this.accessory.context.config.subtype
      );
    }

    if (!service.testCharacteristic(this.api.hap.Characteristic.LastActivation))
      service.addCharacteristic(this.api.hap.Characteristic.LastActivation);

    this.historyService = new this.FakeGatoHistoryService('motion', this.accessory, {
      storage: 'fs',
      path: this.api.user.storagePath() + '/fritzbox/',
      disableTimer: true,
    });

    await timeout(250); //wait for historyService to load

    this.accessory.context.lastSeen = false;

    if (
      this.accessory.displayName === 'Anyone' ||
      (this.accessory.context.polling.timer &&
        !this.accessory.context.polling.exclude.includes(this.accessory.context.config.type) &&
        !this.accessory.context.polling.exclude.includes(this.accessory.context.config.subtype) &&
        !this.accessory.context.polling.exclude.includes(this.accessory.displayName))
    ) {
      service
        .getCharacteristic(this.api.hap.Characteristic.MotionDetected)
        .on(
          'change',
          this.handler.change.bind(this, this.accessory, 'presence', this.accessory.displayName, this.historyService)
        );

      if (this.accessory.displayName === 'Anyone') {
        setTimeout(() => {
          this.getState();
        }, 1000);
      }
    } else {
      service
        .getCharacteristic(this.api.hap.Characteristic.MotionDetected)
        .on(
          'get',
          this.handler.get.bind(
            this,
            this.accessory,
            this.api.hap.Service.MotionSensor,
            this.api.hap.Characteristic.MotionDetected,
            'presence',
            false
          )
        )
        .on(
          'change',
          this.handler.change.bind(this, this.accessory, 'presence', this.accessory.displayName, this.historyService)
        );
    }

    this.refreshHistory(service);
  }

  getState() {
    let state = this.accessory
      .getService(this.api.hap.Service.MotionSensor)
      .getCharacteristic(this.api.hap.Characteristic.MotionDetected).value;
    let states = [];

    for (const accessory of this.accessories) {
      if (accessory.context.config.type.includes('presence') && accessory.displayName !== 'Anyone') {
        let accService = accessory.getService(this.api.hap.Service.OccupancySensor);
        let accChararteristic = this.api.hap.Characteristic.OccupancyDetected;
        if (!accService) {
          accService = accessory.getService(this.api.hap.Service.MotionSensor);
          accChararteristic = this.api.hap.Characteristic.MotionDetected;
        }
        states.push(accService.getCharacteristic(accChararteristic).value);
      }
    }

    state = states.includes(1) || states.includes(true) ? 1 : 0;

    this.accessory
      .getService(this.api.hap.Service.MotionSensor)
      .getCharacteristic(this.api.hap.Characteristic.MotionDetected)
      .updateValue(state);

    setTimeout(() => {
      this.getState();
    }, 3000);
  }

  async refreshHistory(service) {
    let state = service.getCharacteristic(this.api.hap.Characteristic.MotionDetected).value;

    this.historyService.addEntry({
      time: moment().unix(),
      status: state ? 1 : 0,
    });

    setTimeout(() => {
      this.refreshHistory(service);
    }, 10 * 60 * 1000);
  }
}

module.exports = PresenceMotionAccessory;
