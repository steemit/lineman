/**
 * @file Lineman server.
 * @author Johan Nordberg <johan@steemit.com>
 */

import * as cluster from 'cluster'
import * as config from 'config'
import * as http from 'http'
import * as https from 'https'
import * as os from 'os'
import {parse as parseUrl} from 'url'
import * as uws from 'uws'

import {logger} from './logger'

export const version = require('./version')

const rpcOpts = parseUrl(config.get('rpc_node')) as https.RequestOptions
rpcOpts.method = 'POST'

const secure = rpcOpts.protocol === 'https:'
const httpx: any = secure ? https : http

const agentOpts = {keepAlive: true}
rpcOpts.agent = secure ? new https.Agent(agentOpts) : new http.Agent(agentOpts)

export const server = new http.Server((request, response) => {
    if (request.method !== 'GET') {
        response.writeHead(400)
        response.end()
        return
    }
    response.writeHead(200, {'Content-Type': 'application/json'})
    response.end(JSON.stringify({ok: true, version, date: new Date()}))
})

export const wss = new uws.Server({server})

wss.on('connection', (socket) => {
    const {remoteAddress} = (socket as any)._socket
    const log = logger.child({ip: remoteAddress})
    log.info('new connection')
    socket.onclose = () => { log.info('connection closed') }
    socket.onerror = (error) => { log.warn(error, 'socket error') }
    socket.onmessage = async (message) => {
        log.debug({data: message.data}, 'send')
        const request = httpx.request(rpcOpts, (response) => {
            const chunks: Buffer[] = []
            response.on('data', (chunk) => chunks.push(chunk as Buffer))
            response.on('end', () => {
                const data = Buffer.concat(chunks)
                log.debug({data: data.toString()}, 'recv')
                socket.send(data)
            })
        })
        const messageData = Buffer.from(message.data, 'utf8')
        request.setHeader('Content-Type', 'application/json')
        request.setHeader('Content-Length', messageData.byteLength)
        request.write(messageData)
        request.end()
    }
})

function run() {
    const port = config.get('port')
    server.listen(port, () => {
        logger.info('running on port %d', port)
    })
}

if (module === require.main) {
    let numWorkers = config.get('num_workers')
    if (numWorkers === 0) {
        numWorkers = os.cpus().length
    }
    if (numWorkers > 1) {
        if (cluster.isMaster) {
            logger.info('spawning %d workers', numWorkers)
            for (let i = 0; i < numWorkers; i++) {
                cluster.fork()
            }
        } else {
            run()
        }
    } else {
        run()
    }
}
