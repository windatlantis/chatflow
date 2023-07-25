#!/usr/bin/env -S node --no-warnings --loader ts-node/esm
import 'dotenv/config.js'
// import fs from 'fs'
import {
  Contact,
  Message,
  ScanStatus,
  log,
  // Room,
  types,
  Wechaty,
  WechatyBuilder,
} from 'wechaty'

import qrcodeTerminal from 'qrcode-terminal'
import { FileBox } from 'file-box'
import { createWriteStream } from 'fs'
import XLSX from 'xlsx'
import csv from 'fast-csv'
import {
  VikaBot,
  VikaBotConfigTypes,
  configData,
  sendMsg,
  sendNotice,
  imclient,
  wxai,
  ChatDevice,
  propertyMessage,
  eventMessage,

} from './plugins/index.js'
import { baseConfig, config } from './config.js'
import {
  waitForMs as wait,
  formatSentMessage,
} from './util/tool.js'
import schedule from 'node-schedule'
import { db } from './db/tables.js'

log.info('db:', db)
log.info('config:', JSON.stringify(config))
// log.info('process.env', JSON.stringify(process.env))

let bot: Wechaty
let sysConfig: any
let chatdev: any = {}
let job: any
let jobs: any
let vika: VikaBot
let socket: any = {}

baseConfig['VIKA_TOKEN'] = baseConfig['VIKA_TOKEN'] || process.env['VIKA_TOKEN'] || ''
baseConfig['VIKA_SPACENAME'] = baseConfig['VIKA_SPACENAME'] || process.env['VIKA_SPACENAME'] || ''

// log.info(baseConfig)

const vikaConfig:VikaBotConfigTypes = {
  spaceName: baseConfig['VIKA_SPACENAME'],
  token: baseConfig['VIKA_TOKEN'],
}
// log.info(vikaConfig)

function getBot (sysConfig: any) {
  const ops:any = {
    name: 'qa-bot',
    puppet: sysConfig.puppetName,
    puppetOptions: {
      token: sysConfig.puppetToken || 'null',
    },
  }

  log.info(ops)

  if (sysConfig.puppetName === 'wechaty-puppet-service') {
    process.env['WECHATY_PUPPET_SERVICE_NO_TLS_INSECURE_CLIENT'] = 'true'
  }

  if (sysConfig.puppetName === 'wechaty-puppet-wechat4u' || sysConfig.puppetName === 'wechaty-puppet-xp' || sysConfig.puppetName === 'wechaty-puppet-engine') {
    delete ops.puppetOptions.token
  }

  if (sysConfig.puppetName === 'wechaty-puppet-wechat') {
    delete ops.puppetOptions.token
    ops.puppetOptions.uos = true
  }

  log.info('bot ops:', JSON.stringify(getBot))

  const bot = WechatyBuilder.build(ops)
  return bot
}

function getNow () {
  return new Date().toLocaleString()
}

/**
 * 检查配置
 * @param configs 
 * @returns 
 */
function checkConfig (configs: { [key: string]: any }) {
  const missingConfiguration = []

  for (const key in configs) {
    if (!configs[key] && ![ 'imOpen', 'DIFF_REPLY_ONOFF' ].includes(key)) {
      missingConfiguration.push(key)
    }
  }

  if (missingConfiguration.length > 0) {
    log.error('\n======================================\n\n', `错误提示：\n缺少${missingConfiguration.join()}配置参数,请检查环境变量表\n\n======================================`)
    log.info('bot configs:', configs)
    return true
  }
  return true
}

async function relpy (bot:Wechaty, vika:any, replyText:string, message:Message) {
  await message.say(replyText)
  vika.addRecord(await formatSentMessage(bot.currentUser, replyText, message.room() ? undefined : message.talker(), message.room()))
}

async function exportContactsAndRoomsToCSV () {
  // 获取所有联系人和群聊
  const contacts = await bot.Contact.findAll()
  const rooms = await bot.Room.findAll()

  // 准备CSV数据
  const csvData = []
  contacts.forEach((contact:Contact) => {
    if (contact.friend()) {
      csvData.push({  ID: contact.id, Name:Buffer.from(contact.name(), 'utf-8').toString() || '未知', Type:'Contact' })
    }
  })

  for (const room of rooms) {
    csvData.push({  ID:room.id, Name:Buffer.from(await room.topic(), 'utf-8').toString() || '未知', Type:'Room' })
  }

  log.info('通讯录原始数据：', csvData)

  const fileName = './db/contacts_and_rooms.csv'
  const writeStream = createWriteStream(fileName)
  const csvStream = csv.format({ headers: true })
  csvStream.pipe(writeStream).on('end', () => {
    log.info('CSV file written successfully')
  })

  csvData.forEach((item) => {
    csvStream.write(item)
  })

  csvStream.end()

  // 返回FileBox对象
  return FileBox.fromFile(fileName)
}

async function exportContactsAndRoomsToXLSX () {
  // 获取所有联系人和群聊
  const contacts = await bot.Contact.findAll()
  const rooms = await bot.Room.findAll()

  // 准备联系人和群聊数据
  const contactsData = [ [ 'Name', 'ID' ] ]
  const roomsData = [ [ 'Name', 'ID' ] ]
  contacts.forEach((contact) => {
    if (contact.friend()) {
      contactsData.push([ contact.name(), contact.id ])
    }
  })

  for (const room of rooms) {
    roomsData.push([ await room.topic(), room.id ])
  }

  // 创建一个新的工作簿
  const workbook = XLSX.utils.book_new()

  // 将数据添加到工作簿的不同sheet中
  const contactsSheet = XLSX.utils.aoa_to_sheet(contactsData)
  const roomsSheet = XLSX.utils.aoa_to_sheet(roomsData)
  XLSX.utils.book_append_sheet(workbook, contactsSheet, 'Contacts')
  XLSX.utils.book_append_sheet(workbook, roomsSheet, 'Rooms')

  // 将工作簿写入文件
  const fileName = './db/contacts_and_rooms.xlsx'
  XLSX.writeFile(workbook, fileName)

  // 返回FileBox对象
  return FileBox.fromFile(fileName)
}

async function updateJobs (bot: Wechaty, vika:any) {
  try {
    const tasks = await vika.getTimedTask()
    schedule.gracefulShutdown()
    jobs = {}
    // log.info(tasks)
    for (let i = 0; i < tasks.length; i++) {
      const task: any = tasks[i]
      if (task.active) {
        const curTimeF = new Date(task.time)
        // const curTimeF = new Date(task.time+8*60*60*1000)
        let curRule = '* * * * * *'
        let dayOfWeek: any = '*'
        let month: any = '*'
        let dayOfMonth: any = '*'
        let hour: any = curTimeF.getHours()
        let minute: any = curTimeF.getMinutes()
        const second = 0
        const addMonth = []
        switch (task.cycle) {
          case '每季度':
            month = curTimeF.getMonth()
            for (let i = 0; i < 4; i++) {
              if (month + 3 <= 11) {
                addMonth.push(month)
              } else {
                addMonth.push(month - 9)
              }
              month = month + 3
            }
            month = addMonth
            break
          case '每天':
            break
          case '每周':
            dayOfWeek = curTimeF.getDay()
            break
          case '每月':
            month = curTimeF.getMonth()
            break
          case '每小时':
            hour = '*'
            break
          case '每30分钟':
            hour = '*'
            minute = [ 0, 30 ]
            break
          case '每15分钟':
            hour = '*'
            minute = [ 0, 15, 30, 45 ]
            break
          case '每10分钟':
            hour = '*'
            minute = [ 0, 10, 20, 30, 40, 50 ]
            break
          case '每5分钟':
            hour = '*'
            minute = [ 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 ]
            break
          case '每分钟':
            hour = '*'
            minute = '*'
            break
          default:
            month = curTimeF.getMonth()
            dayOfMonth = curTimeF.getDate()
            break

        }
        curRule = `${second} ${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`
        log.info(curRule)

        try {
          schedule.scheduleJob(task.id, curRule, async () => {
            try {
              const curDate = new Date()
              log.info('定时任务：', curTimeF, curRule, curDate, JSON.stringify(task))
              // await user.say('心跳：' + curDate)

              try {
                if (task.contacts.length) {
                  const contact = await bot.Contact.find({ id: task.contacts[0] })
                  if (contact) {
                    await contact.say(task.msg)
                    vika.addRecord(await formatSentMessage(bot.currentUser, task.msg, contact, undefined))
                    await wait(200)
                  }
                }
              } catch (e) {
                log.error('发送好友定时任务失败:', e)
              }

              try {
                if (task.rooms.length) {
                  const room = await bot.Room.find({ id: task.rooms[0] })
                  if (room) {
                    await room.say(task.msg)
                    vika.addRecord(await formatSentMessage(bot.currentUser, task.msg, undefined, room))
                    await wait(200)
                  }
                }
              } catch (e) {
                log.error('发送群定时任务失败:', e)

              }

            } catch (err) {
              log.error('定时任务执行失败：', err)
            }
          })
          jobs[task.id] = task
        } catch (e) {
          log.error('创建定时任务失败:', e)
        }
      }
    }
    log.info('通知提醒任务初始化完成，创建任务数量：', Object.keys(jobs).length)

  } catch (err: any) {
    log.error('更新通知提醒列表任务失败：', err)
  }
}

async function onScan (qrcode: string, status: ScanStatus) {
  // 上传二维码到维格表，可通过扫码维格表中二维码登录
  await vika.onScan(qrcode, status)

  // 控制台显示二维码
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    const qrcodeUrl = encodeURIComponent(qrcode)
    const qrcodeImageUrl = [
      'https://wechaty.js.org/qrcode/',
      qrcodeUrl,
    ].join('')
    log.info('StarterBot', 'onScan: %s(%s) - %s', ScanStatus[status], status, qrcodeImageUrl)
    qrcodeTerminal.generate(qrcode, { small: true })  // show qrcode on console

  } else {
    log.info('StarterBot', 'onScan: %s(%s)', ScanStatus[status], status)
  }
}

async function onLogin (user: Contact) {
  log.info('StarterBot', '%s login', user)
  log.info('当前登录的账号信息：', JSON.stringify(user))

  // 启动MQTT通道
  if (sysConfig.mqttPassword && (sysConfig.mqtt_SUB_ONOFF || sysConfig.mqtt_PUB_ONOFF)) {
    chatdev = new ChatDevice(sysConfig.mqttUsername, sysConfig.mqttPassword, sysConfig.mqttEndpoint, sysConfig.mqttPort, user.id)
    if (sysConfig.mqtt_SUB_ONOFF) {
      chatdev.init(bot)
    }
  }

  const curDate = new Date().toLocaleString()
  // await user.say('上线：' + curDate)

  // 更新云端好友和群
  await vika.updateRooms(bot)
  await vika.updateContacts(bot)

  // 如果开启了MQTT推送，心跳同步到MQTT,每30s一次
  setInterval(() => {
    try {
      log.info(curDate)
      if (chatdev && sysConfig.mqtt_PUB_ONOFF) {
        chatdev.pub_property(propertyMessage('lastActive', curDate))
      }
    } catch (err) {
      log.error('发送心跳失败：', err)
    }
  }, 300000)

  // 启动用户定时通知提醒任务
  await updateJobs(bot, vika)
  log.info('================================================\n\n登录启动成功，程序准备就绪\n\n================================================\n')
}

async function onReady () {
  const user: Contact = bot.currentUser
  log.info('StarterBot', '%s ready', user)
  log.info('当前登录的账号信息：', JSON.stringify(user))

  // 启动MQTT通道
  if (sysConfig.mqttPassword && (sysConfig.mqtt_SUB_ONOFF || sysConfig.mqtt_PUB_ONOFF)) {
    chatdev = new ChatDevice(sysConfig.mqttUsername, sysConfig.mqttPassword, sysConfig.mqttEndpoint, sysConfig.mqttPort, user.id)
    if (sysConfig.mqtt_SUB_ONOFF) {
      chatdev.init(bot)
    }
  }

  const curDate = new Date().toLocaleString()
  // await user.say('上线：' + curDate)

  // 更新云端好友和群
  await vika.updateRooms(bot)
  await vika.updateContacts(bot)

  // 如果开启了MQTT推送，心跳同步到MQTT,每30s一次
  setInterval(() => {
    try {
      log.info(curDate)
      if (chatdev && sysConfig.mqtt_PUB_ONOFF) {
        chatdev.pub_property(propertyMessage('lastActive', curDate))
      }
    } catch (err) {
      log.error('发送心跳失败：', err)
    }
  }, 300000)

  // 启动用户定时通知提醒任务
  await updateJobs(bot, vika)
  log.info('================================================\n\n登录启动成功，程序准备就绪\n\n================================================\n')
}

function onLogout (user: Contact) {
  log.info('StarterBot', '%s logout', user)
  job.cancel()
}

async function onMessage (message: Message) {
  // log.info('onMessage', JSON.stringify(message))
  await vika.onMessage(message)
  const curDate = new Date().toLocaleString()

  // MQTT上报
  if (chatdev && sysConfig.mqtt_PUB_ONOFF) {
    /*
    将消息通过mqtt通道上报到云端
    */
    // chatdev.pub_message(message)
    chatdev.pub_event(eventMessage('onMessage', { curDate }))

  }

  const talker = message.talker()
  const text = message.text()
  const room = message.room()
  const roomId = room?.id
  const topic = await room?.topic()
  const keyWord = bot.currentUser.name()
  const isSelfMsg = message.self()
  log.info('keyWord is:', keyWord)
  if (isSelfMsg) {
    await sendNotice(bot, message)
  }

  let replyText: string = ''
  if (isSelfMsg && (text === '#指令列表' || text === '#帮助')) {
    replyText = `操作指令说明：\n
    #更新配置 更新全部配置
    #更新提醒 更新定时提醒任务
    #更新通讯录 更新维格表通信录
    #下载通讯录 下载通讯录xlsx表
    #下载通知模板 下载通知模板`

    await relpy(bot, vika, replyText, message)
  }

  if (isSelfMsg && text === '#更新配置') {
    log.info('热更新系统配置~')
    try {
      sysConfig = await vika.getConfig()
      // message.say('配置更新成功：' + JSON.stringify(newConfig))
      log.info('newConfig', sysConfig)
      replyText = '配置更新成功~'
    } catch (e) {
      replyText = '配置更新成功~'
    }

    await relpy(bot, vika, getNow() + replyText, message)
  }

  if (isSelfMsg && text === '#更新提醒') {
    log.info('热更新通知任务~')
    try {
      await updateJobs(bot, vika)
      replyText = '提醒任务更新成功~'
    } catch (e) {
      replyText = '提醒任务更新失败~'
    }

    await relpy(bot, vika, getNow() + replyText, message)
  }

  if (isSelfMsg && text === '#更新通讯录') {
    log.info('热更新通讯录到维格表~')
    try {
      await vika.updateContacts(bot)
      await vika.updateRooms(bot)
      replyText = '通讯录更新成功~'
    } catch (e) {
      replyText = '通讯录更新失败~'
    }

    await relpy(bot, vika, getNow() + replyText, message)
  }

  if (isSelfMsg && text === '#下载csv通讯录') {
    log.info('下载通讯录到csv表~')
    try {
      const fileBox = await exportContactsAndRoomsToCSV()
      await message.say(fileBox)
    } catch (err) {
      log.error('exportContactsAndRoomsToCSV', err)
      await message.say('下载失败~')
    }
  }

  if (isSelfMsg && text === '#下载通讯录') {
    log.info('下载通讯录到xlsx表~')
    try {
      const fileBox = await exportContactsAndRoomsToXLSX()
      await message.say(fileBox)
    } catch (err) {
      log.error('exportContactsAndRoomsToXLSX', err)
    }
  }

  if (isSelfMsg && text === '#下载通知模板') {
    log.info('下载通知模板~')
    try {
      const fileBox = FileBox.fromFile('./src/templates/群发通知模板.xlsx')
      await message.say(fileBox)
    } catch (err) {
      log.error('下载模板失败', err)
      await message.say('下载失败，请重试~')
    }
  }

  try {

    if (room && roomId && !isSelfMsg) {

      // 智能问答开启时执行
      if (sysConfig.WX_OPENAI_ONOFF && ((text.indexOf(keyWord) !== -1 && sysConfig.AT_AHEAD) || !sysConfig.AT_AHEAD)) {
        if (sysConfig.roomWhiteListOpen) {
          const isInRoomWhiteList = sysConfig.roomWhiteList.includes(roomId)
          if (isInRoomWhiteList) {
            log.info('当前群在白名单内，请求问答...')
            await wxai(sysConfig, bot, talker, room, message)
          } else {
            log.info('当前群不在白名单内，流程结束')
          }
        }

        if (!sysConfig.roomWhiteListOpen) {
          log.info('系统未开启白名单，请求问答...')
          await wxai(sysConfig, bot, talker, room, message)
        }
      }

      // IM服务开启时执行
      if (sysConfig.imOpen && types.Message.Text === message.type()) {
        configData.clientChatEn.clientChatId = talker.id + ' ' + room.id
        configData.clientChatEn.clientChatName = talker.name() + '@' + topic
        // log.debug(configData)
        socket.emit('CLIENT_ON', {
          clientChatEn: configData.clientChatEn,
          serverChatId: configData.serverChatEn.serverChatId,
        })
        const data = {
          msg: {
            avatarUrl: '/static/image/im_server_avatar.png',
            content: text,
            contentType: 'text',
            role: 'client',
          },
        }
        log.info(JSON.stringify(data))
        sendMsg(data)
      }

    }

    if ((!room || !room.id) && !isSelfMsg) {
      // 智能问答开启时执行
      if (sysConfig.WX_OPENAI_ONOFF && ((text.indexOf(keyWord) !== -1 && sysConfig.AT_AHEAD) || !sysConfig.AT_AHEAD)) {
        if (sysConfig.contactWhiteListOpen) {
          const isInContactWhiteList = sysConfig.contactWhiteList.includes(talker.id)
          if (isInContactWhiteList) {
            log.info('当前好友在白名单内，请求问答...')
            await wxai(sysConfig, bot, talker, undefined, message)
          } else {
            log.info('当前好友不在白名单内，流程结束')
          }
        }

        if (!sysConfig.contactWhiteListOpen) {
          log.info('系统未开启好友白名单,对所有好友有效，请求问答...')
          await wxai(sysConfig, bot, talker, undefined, message)
        }
      }
    }

  } catch (e) {
    log.error('发起请求wxai失败', e)
  }
}

async function roomJoin (room: { topic: () => any; id: any; say: (arg0: string, arg1: any) => any }, inviteeList: Contact[], inviter: any) {
  const nameList = inviteeList.map(c => c.name()).join(',')
  log.info(`Room ${await room.topic()} got new member ${nameList}, invited by ${inviter}`)

  // 进群欢迎语，仅对开启了进群欢迎语白名单的群有效
  if (sysConfig.welcomeList.includes(room.id) && inviteeList.length) {
    await room.say(`欢迎加入${await room.topic()},请阅读群公告~`, inviteeList)
  }
}

async function onError (err:any) {
  log.error('bot.onError:', JSON.stringify(err))
  try {
    job.cancel()
  } catch (e) {
    log.error('销毁定时任务失败：', JSON.stringify(e))
  }
}

async function main (vika: VikaBot) {
  // 初始化获取配置信息
  await vika.init()
  // 检查vika表与本地配置是否数量一致
  const initReady = await vika.checkInit('主程序载入系统配置成功，等待插件初始化...')
  if (!initReady) {
    return
  }

  // 获取系统配置信息
  sysConfig = await vika.getConfig()
  config.botConfig.bot = sysConfig
  // 检查配置
  const configReady = checkConfig(sysConfig)

  // 配置齐全，启动机器人
  if (configReady) {
    bot = getBot(sysConfig)
    bot.on('scan', onScan)

    if (sysConfig.puppetName === 'wechaty-puppet-xp') {
      bot.on('login', onLogin)
    }
    if (sysConfig.puppetName !== 'wechaty-puppet-xp') {
      bot.on('ready', onReady)
    }

    bot.on('logout', onLogout)
    bot.on('message', onMessage)
    bot.on('room-join', roomJoin)
    bot.on('error', onError)

    bot.start()
      .then(() => log.info('Starter Bot Started.'))
      .catch((e: any) => log.error('bot运行异常：', JSON.stringify(e)))

    if (sysConfig.imOpen) {
      socket = imclient(bot, vika, configData)
    }
  }
}

// 检查本地json配置并启动
if (vikaConfig.spaceName && vikaConfig.token) {
  // 使用本地json配置vikabot
  vika = new VikaBot(vikaConfig)
  void main(vika)
} else {
  log.error('\n================================================\n\nvikaConfig配置缺少token或spaceName，请检查config.json文件\n\n================================================\n')

}
