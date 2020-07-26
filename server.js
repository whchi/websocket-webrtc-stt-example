const Koa = require('koa')
const app = new Koa()
const speech = require('@google-cloud/speech').v1p1beta1
const WebSocketServer = require('websocket').server
const http = require('http')
const server = http.createServer(app.callback())

const wsServer = new WebSocketServer({
  httpServer: server,
})

const speechClient = new speech.SpeechClient()
require('dotenv').config()
server.listen(process.env.PORT, () => {
  console.log(`listen on port ${process.env.PORT}`)
})
var msgObj = { isFinal: false, text: '' }
const cfg = {
  config: {
    encoding: 'LINEAR16',
    sampleRateHertz: 48000,
    languageCode: 'zh-TW',
  },
  interimResults: true,
  //   singleUtterance: true,
}
const recognizer = speechClient
  .streamingRecognize(cfg)
  .on('close', e => {
    console.log(e)
    console.info('info')
  })
  .on('end', console.info)
  .on('data', data => {
    dataHandler(data)
  })

function errorHandler(err) {
  this.close()
  if (err.code === 11) {
    // console.log(err);
  }
}
wsServer.on('request', function (request) {
  var connection = request.accept(null, request.origin)
  // This is the most important callback for us, we'll handle
  // all messages from users here.
  connection.on('message', msg => {
    recognizer.write(msg.binaryData)
    if (msgObj.isFinal) {
      msgObj.isFinal = false
      connection.send(msgObj.text)
      msgObj.text = ''
    }
  })
  connection.on('close', () => {
    console.log('connclose')
    msgObj.isFinal = false
    msgObj.text = ''
    speechClient.close()
    connection.send('end_from_server')
  })
})

function dataHandler(stream, cb) {
  if (stream.results[0].isFinal) {
    let text = stream.results[0].alternatives[0].transcript
    console.log(`Transcription: ${text}`)
    msgObj.isFinal = true
    msgObj.text = text + ', isFinal=true'
  }
}
