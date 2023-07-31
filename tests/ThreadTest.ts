import schedule from 'node-schedule'
import cronParse from 'cron-parser'

const scheduleCronstyle = ()=>{
    console.log('scheduleCronstyle')
    schedule.scheduleJob('test', '0/30 * * ? * 1-5', () => {
        console.log(new Date() + ' is run')
    })
}
scheduleCronstyle()


const interval = cronParse.parseExpression('0/30 * * ? * 1-5')
for(let i=0;i<10;i++) {
    console.log('cronDate:', interval.next().toString())
}


export { scheduleCronstyle }