import schedule from 'node-schedule'

import axios from 'axios'
import type { Wechaty } from 'wechaty'
import waitForMs from '../util/tool.js'
import qs from 'qs'


const addStockTask = async (bot:Wechaty) => {
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
            await waitForMs(200)
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
        'id_list': 'acb4d1f4-1c99-11ee-9b74-4ae3bc20a59c;9be628d6-1bcd-11ee-ba27-6ecd40b2bc6c'
    }

    try {
        const response = await axios.post(apiUrl, payload, 
            { 
                headers : headers, 
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
                            plans.push(order.dt + ' ' + order.direction + ' ' + order.sid + order.name + ' ' + order.amount_after_adjust + '股')
                        }
                        strategys.push(strategy.strategy_name + ': \n\t' + plans.join('\n\t'))
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

export { addStockTask, getStockPlan }