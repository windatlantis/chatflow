import schedule from 'node-schedule'

import axios from 'axios'
import type { Room, Wechaty } from 'wechaty'
import waitForMs, { formatSentMessage } from '../util/tool.js'
import qs from 'qs'
import type VikaBot from '../plugins/vika.js'

/**
 * 设置定时任务
 * @param bot 
 * @param vika 
 */
const addStockTask = async (bot:Wechaty, vika:VikaBot) => {
    console.log('enter addStockTask')
    schedule.scheduleJob('StockTask', '0 0 8 ? * 1-5', async () => {
    // schedule.scheduleJob('StockTask', '0 0/1 * * * *', async () => {
        console.log('StockTask running')
        const planDetail = await getStockPlan()
        const room = await bot.Room.find({topic: '我还能卖你个生瓜蛋子'})
        if (room) {
            // await room.say('测试一下定时')
            // await waitForMs(200)
            await room.say(planDetail)
            await record(bot, vika, planDetail, room)
        }
    })
}

/**
 * 获取模拟交易计划
 * @returns 
 */
async function getStockPlan() {
    const token = ''
    const apiUrl = 'https://bigquant.com/bigwebapi/algo_info/planned_orders'
    const headers = {
        'Authorization': 'Bearer ' + token.trim().replace('\n', ''),
    }
    
    const payload = {
        'id_list': 'acb4d1f4-1c99-11ee-9b74-4ae3bc20a59c;9be628d6-1bcd-11ee-ba27-6ecd40b2bc6c;4b19867e-1e6f-11ee-865f-b245992626cd'
    }

    try {
        const response = await axios.post(apiUrl, payload, 
            { 
                headers : headers, 
                // axios默认json传值，需要转化成表单格式
                transformRequest: [function (data) {
                    return qs.stringify(data)
                }] 
            })
        console.info('获取模拟交易：', JSON.stringify(response.data))
        if (response && response.data) {
            if (response.data.statusCode == 200) {
                const data = response.data.data
                let strategys:string[] = []
                for (const strategy of data) {
                    let plans:string[] = []
                    if (strategy.planned_orders.length > 0) {
                        for (const order of strategy.planned_orders) {
                            plans.push('* ' + order.dt + ' ' + order.direction + ' ' + order.sid + order.name + ' ' + order.amount_after_adjust + '股')
                        }
                        strategys.push(strategy.strategy_name + ': \n' + plans.join('\n'))
                    }
                }
                return '模拟交易：\n\n' + strategys.join('\n\n') 
            } else {
                return '获取模拟交易失败：' + response.data.info.FailureReason
            }
        }
        return '获取模拟交易无返回值'
    } catch (error) {
        console.error(error)
        return '获取模拟交易异常'
    }
}

/**
 * 写入vika记录
 * @param bot 
 * @param vika 
 * @param replyText 
 * @param room 
 */
async function record (bot:Wechaty, vika:VikaBot, replyText:string, room:Room) {
    vika.addRecord(await formatSentMessage(bot.currentUser, replyText, undefined, room))
    await waitForMs(1000)
}

export { addStockTask, getStockPlan }