import schedule from 'node-schedule'


const scheduleCronstyle = ()=>{
    schedule.scheduleJob('test', '2 0/1 * * * *', () => {
        console.log(new Date() + ' is run')
    })
}
scheduleCronstyle()
for (let i in schedule.scheduledJobs) {
    console.error("任务名称："+i);
}


export { scheduleCronstyle }