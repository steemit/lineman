import 'mocha'
import * as assert from 'assert'
import * as needle from 'needle'
import * as WebSocket from 'ws'

import {server} from './../src/server'

describe('server', function() {
    const port = process.env['TEST_HTTP_PORT'] ? parseInt(process.env['TEST_HTTP_PORT'] as string) : 63205

    before((done) => { server.listen(port, 'localhost', done) })
    after((done) => { server.close(done) })

    it('should healthcheck', async function() {
        const rv = await needle('get', `localhost:${ port }`)
        assert(rv.statusCode === 200)
        assert(rv.body.ok === true)
    })

    it('should proxy websockets', function(done) {
        this.slow(2 * 1000)
        this.timeout(5 * 1000)
        const ws = new WebSocket(`ws://localhost:${ port }`)
        ws.onerror = done
        ws.onopen = () => {
            const params = ['database_api', 'get_accounts', [['almost-digital']]]
            const request = {id: 1, jsonrpc: '2.0', method: 'call', params}
            ws.send(JSON.stringify(request))
            ws.onmessage = (response) => {
                const data = JSON.parse(response.data.toString())
                assert.equal(data.result[0].id, 180270)
                assert.equal(data.result[0].name, 'almost-digital')
                done()
            }
        }

    })

})
