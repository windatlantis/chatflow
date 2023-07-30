import { type } from 'os';
/*
修改config.json配置文件，参考一下说明修改
{
    "baseConfig": {
        "VIKA_TOKEN": "修改为自己的维格表token",
        "VIKA_SPACENAME": "修改为自己的维格表空间名称",
        "puppetName": "wechaty-puppet-wechat4u", //可选值：wechaty-puppet-wechat4u、wechaty-puppet-wechat、wechaty-puppet-xp、wechaty-puppet-engine、wechaty-puppet-padlocal、wechaty-puppet-service
        "puppetToken": ""
    },
}
*/
import fs from 'fs'

type KeyObjConfigs = {
  [key: string]: any;
}

type ConfigJson = {
  baseConfig: KeyObjConfigs,
  botConfig: KeyObjConfigs,
  contactConfig: KeyObjConfigs,
  roomConfig: KeyObjConfigs,
}

let config:ConfigJson = JSON.parse(fs.readFileSync('src/config.json', 'utf8')) as ConfigJson

// 配置文件，所有配置必须齐全，补充空白配置项，其他配置项可按需要修改
const baseConfig:KeyObjConfigs = config.baseConfig

export type { ConfigJson, KeyObjConfigs}
export { baseConfig, config }
