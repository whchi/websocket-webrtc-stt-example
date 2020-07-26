// init global variables
const audioCtx = window.AudioContext || window.webkitAudioContext;
// const offlineAudioCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

const WS_URI = 'ws://localhost:3000/';
// const DESIRE_SAMPLE_RATE = 48000;
// const SAMPLE_RATE = 48000;
const MAX_INT = Math.pow(2, 16 - 1) - 1;

const RECORDER_BUFFER_SIZE = 4096;
const constraints = {
  audio: true,
  video: false,
};
var rtc = {};
var sttRst = undefined;

if (location.href.indexOf('site_admin') > -1) {
  // do nothing
} else {
  RTC();
  document.getElementById('sttservicetype').addEventListener(
    'change',
    function (e) {
      rtc.setSTTService(this.options[this.selectedIndex].value);
      rtc.setAudioBufLen(
        parseInt(this.options[this.selectedIndex].getAttribute('data-bufl'))
      );
    },
    false
  );
}

function RTC() {
  var context,
    audioInput,
    recorder,
    ws,
    audioStream,
    sttService,
    stt,
    audioBufLen;
  var notSupport = false;
  var stt = false;
  rtc = {
    initialize: function () {
      if (/rv:11|MSIE|Trident|firefox/i.test(navigator.userAgent)) {
        notSupport = !navigator.mediaDevices || !navigator.getUserMedia;
      } else {
        notSupport = !navigator.mediaDevices.getUserMedia;
      }
      if (notSupport) {
        alert('getUserMedia not support on your browser');
        return;
      }
      if (!navigator.mediaDevices.getUserMedia) {
        alert('getUserMedia not support on your browser');
        return;
      }
      stt = true;
      this.setSTTService('google');
      this.setAudioBufLen(4096);
    },
    setSTTService: function (s) {
      sttService = s;
    },
    getSTTService: function () {
      return sttService;
    },
    setAudioBufLen: function (l) {
      audioBufLen = l;
    },
    getAudioBufLen: function () {
      return audioBufLen;
    },
    startRecord: function (e) {
      e.target.setAttribute('disabled', 'disabled');
      document.getElementById('stop').removeAttribute('disabled');
      context = new audioCtx();
      recorder = context.createScriptProcessor(RECORDER_BUFFER_SIZE, 1, 1);
      recorder.connect(context.destination);
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then(gotMediaStream)
        .catch(console.error);
    },
    stopRecord: function (e) {
      if (e) {
        e.target.setAttribute('disabled', 'disabled');
      } else {
        document.getElementById('stop').click();
      }

      document.getElementById('start').removeAttribute('disabled');
      recorder.disconnect();
      audioInput.disconnect();
      context
        .close()
        .then(function () {
          ws.close();
        })
        .catch(console.error);
    },
    getResult: function () {
      return sttRst;
    },
    resetResult: function () {
      sttRst = undefined;
    },
    sttIsAvailable: function () {
      return stt;
    },
  };

  function recorderProcess(e) {
    var ipt = interpolateArray(
      e.inputBuffer.getChannelData(0),
      rtc.getAudioBufLen(),
      e.inputBuffer.sampleRate
    );
    ws.send(F32ArytoI16Ary(ipt));
    // old code
    // switch (rtc.getSTTService()) {
    // 	case 'microsoft':
    // 		// 16kHz is a problem using OfflineAudioContext
    // 		// reSample(inputBuffer, DESIRE_SAMPLE_RATE, sendToWebsocket);
    // 		var ipt = interpolateArray(inputBuffer.getChannelData(0), rtc.getAudioBufLen(), inputBuffer.sampleRate);
    // 		ws.send(Int16Array.from(ipt.map(function (n) {
    // 			return n * MAX_INT;
    // 		})));
    // 		break;
    // 	default:
    // 		var ipt = interpolateArray(inputBuffer.getChannelData(0), rtc.getAudioBufLen(), inputBuffer.sampleRate);
    // 		ws.send(Int16Array.from(ipt.map(function (n) {
    // 			return n * MAX_INT;
    // 		})));
    // 		// 48kHz is not a problem
    // 		// for (var channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
    // 		// 	var inputData = inputBuffer.getChannelData(channel);
    // 		// 	ws.send(Int16Array.from(inputData.map(function (n) {
    // 		// 		return n * MAX_INT;
    // 		// 	})));
    // 		// 	sleep(50);
    // 		// }
    // 		break;
    // }
  }
  // use native class OfflineAudioContext, reenable when OfflineAudioCtx issue was solved
  // for more information: https://bugs.webkit.org/show_bug.cgi?id=182475

  // function reSample(audioBuffer, targetSampleRate, onComplete) {
  // 	var channel = audioBuffer.numberOfChannels;
  // 	var samples = audioBuffer.length * targetSampleRate / audioBuffer.sampleRate;
  // 	var offlineContext = new offlineAudioCtx(channel, samples, targetSampleRate);
  // 	// console.log(offlineContext);
  // 	var bufferSource = offlineContext.createBufferSource();
  // 	bufferSource.buffer = audioBuffer;
  // 	bufferSource.connect(offlineContext.destination);
  // 	bufferSource.start(0);
  // 	offlineContext.startRendering();
  // 	offlineContext.oncomplete = function (renderedBuffer) {
  // 		onComplete(renderedBuffer);
  // 	}
  // }

  // function sendToWebsocket(audiobuf) {
  // 	for (var channel = 0; channel < audiobuf.numberOfChannels; channel++) {
  // 		var inputData = audiobuf.getChannelData(channel);
  // 		ws.send(Int16Array.from(inputData.map(function (n) {
  // 			return n * MAX_INT;
  // 		})));
  // 		sleep(50);
  // 	}
  // }

  function sleep(ms) {
    return new Promise(function (res) {
      setTimeout(res, ms);
    });
  }

  function F32ArytoI16Ary(iptData) {
    return Int16Array.from(
      iptData.map(function (n) {
        return n * MAX_INT;
      })
    );
  }

  function interpolateArray(data, newSampleRate, oldSampleRate) {
    // var fitCount = Math.round(data.length * (newSampleRate / oldSampleRate));
    var fitCount = rtc.getAudioBufLen();
    var newData = [];
    var springFactor = Number((data.length - 1) / (fitCount - 1));
    newData[0] = data[0];
    for (var i = 1; i < fitCount - 1; i++) {
      var tmp = i * springFactor;
      var before = Number(Math.floor(tmp)).toFixed();
      var after = Number(Math.ceil(tmp)).toFixed();
      var atPoint = tmp - before;
      newData[i] = linearInterpolate(data[before], data[after], atPoint);
    }
    newData[fitCount - 1] = data[data.length - 1];

    return newData;
  }

  function linearInterpolate(before, after, atPoint) {
    return before + (after - before) * atPoint;
  }

  function gotMediaStream(stream) {
    audioInput = context.createMediaStreamSource(stream);
    audioInput.connect(recorder);
    ws = new WebSocket(WS_URI);

    ws.onopen = function () {
      console.log('websocket connection established...');
      ws.send(sttService);
      recorder.onaudioprocess = recorderProcess;
    };
    ws.onmessage = function (evt) {
      console.log('received : ' + evt.data);
      var answer = evt.data;
      if (
        answer.indexOf(', isFinal=true') > -1 ||
        answer.indexOf('end_from_server') > -1
      ) {
        startrec.removeAttribute('disabled');
        var ans =
          answer.substring(0, answer.indexOf(', isFinal=true')) || answer;
        sttrst.appendChild(
          document.createTextNode(rtc.getSTTService() + ' result: ' + ans)
        );
        sttrst.appendChild(document.createElement('br'));
        rtc.stopRecord();
      }
    };
    ws.onclose = function (evt) {
      console.log('Get message from server: ' + evt);
      console.log('websocket connection closed...');
    };
    ws.onerror = function (err) {
      console.error(err);
      ws.close();
    };
  }
  rtc.initialize();
}

var startrec = document.getElementById('start'),
  sttrst = document.getElementById('sttrst');
startrec.addEventListener('click', rtc.startRecord, false);
document
  .getElementById('stop')
  .addEventListener('click', rtc.stopRecord, false);
