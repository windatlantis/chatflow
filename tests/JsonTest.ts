
function test1() {
    const str = ' {"data":[{"strategy_name":"DDE小市值","last_run_date":"2023-07-28","planned_orders":[{"sid":"000702.SZA","direction":"卖","dt":"2023-07-31 15:00:00","amount_after_adjust":2800,"name":"正虹科技","price":6.01,"hold_percent":0.3313638706359046},{"sid":"603021.SHA","direction":"卖","dt":"2023-07-31 15:00:00","amount_after_adjust":3100,"name":"山东华鹏","price":5.64,"hold_percent":0.3442813117541096},{"sid":"600889.SHA","direction":"卖","dt":"2023-07-31 15:00:00","amount_after_adjust":3200,"name":"南京化纤","price":5.12,"hold_percent":0.32262096841565613},{"sid":"600768.SHA","direction":"买","dt":"2023-07-31 15:00:00","amount_after_adjust":1500,"name":"宁波富邦","price":11.12,"hold_percent":0.3284495698958218},{"sid":"002848.SZA","direction":"买","dt":"2023-07-31 15:00:00","amount_after_adjust":1600,"name":"高斯贝尔","price":10,"hold_percent":0.3150595394684142},{"sid":"603958.SHA","direction":"买","dt":"2023-07-31 15:00:00","amount_after_adjust":2000,"name":"哈森股份","price":8.1,"hold_percent":0.31899778371176934}],"notebook_id":"4b19867e-1e6f-11ee-865f-b245992626cd"},{"strategy_name":"金三角银三角 copy","last_run_date":"2023-07-28","planned_orders":[{"sid":"600801.SHA","direction":"卖","dt":"2023-07-31 09:30:00","amount_after_adjust":3500,"name":"华新水泥","price":13.7,"hold_percent":0.9710041990477482},{"sid":"600383.SHA","direction":"买","dt":"2023-07-31 09:30:00","amount_after_adjust":5800,"name":"金地集团","price":8.46,"hold_percent":0.9936440884019794}],"notebook_id":"9be628d6-1bcd-11ee-ba27-6ecd40b2bc6c"},{"strategy_name":"中证小市值改编策略","last_run_date":"2023-07-28","planned_orders":[],"notebook_id":"acb4d1f4-1c99-11ee-9b74-4ae3bc20a59c"}],"metadata":{"tabelname":"planned_order_lists","total_count":3},"statusCode":200,"message":"请求成功","result":true,"info":""}'
    const jsonObj = JSON.parse(str)
    for (const strategy of jsonObj.data) {
        console.log('--- ' + JSON.stringify(strategy))
        let plan:string[] = []
        if (strategy.planned_orders.length > 0) {
            for (const order of strategy.planned_orders) {
                plan.push(order.dt + ' ' + order.direction + ' ' + order.sid + order.name + ' ' + order.amount_after_adjust + '股')
            }
        }
        console.log(strategy.strategy_name + ': \n\t' + plan.join('\n\t'))
    }
}

test1()

export { test1 }