import onMessage from '../handlers/on-message.js'
import onScan from '../handlers/on-scan.js'

import type {
  Message,
  ScanStatus,
  Wechaty,
} from 'wechaty'

import { VikaBot, VikaBotConfigTypes } from './vika.js'
import {
  configData,
  addChatMsg,
  imclient,
  sendMsg,
} from './im.js'
import { wxai } from './wxai.js'
import { sendNotice } from './group-notice.js'

import { ChatDevice } from './chat-device.js'
import { propertyMessage, eventMessage } from './msg-format.js'
import { getFormattedRideInfo } from './riding.js'
import { type } from 'os'

function WechatyVikaPlugin (vika: VikaBot) {
  return function (bot: Wechaty) {
    bot.on('scan', async (qrcode: string, status: ScanStatus) => {
      await onScan(qrcode, status, vika)
    })
    bot.on('login', async () => {
      // await vika.checkInit('vika插件载入系统配置完成，系统启动成功~')
    })
    bot.on('message', async (msg: Message) => {
      await onMessage(msg, vika)
    })
  }
}

export {
  WechatyVikaPlugin,
  VikaBot,
  configData,
  imclient,
  addChatMsg,
  getFormattedRideInfo,
  sendMsg,
  sendNotice,
  wxai,
  ChatDevice,
  propertyMessage,
  eventMessage,
}
export type {
  VikaBotConfigTypes
}

export default WechatyVikaPlugin
