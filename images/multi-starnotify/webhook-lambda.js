'use strict';

const AWS = require('aws-sdk');
const SQS = new AWS.SQS({ apiVersion: '2012-11-05' });
const querystring = require('querystring');

const queueBase = 'https://sqs.us-west-2.amazonaws.com/414064234042/';
const oldQueues = [
    // 'bugsnag',
    // 'cloudwatch', 'grafana', 'upcheck',
    // 'github',
    // 'gitlab',
    // 'mailgun', 'slackjack',
    // 'radarr', 'sonarr',
    // 'travisci',
];

exports.handler = (event, context, callback) => {
    try {
        // make a labelled envelope
        const {userAgent, sourceIp} = event.requestContext.identity;
        const body = {userAgent, sourceIp};
        body.headers = event.headers;
        body.parameters = event.queryStringParameters;
        body.receivedAt = Date.now();

        // select content-type
        for (const key in event.headers) {
            if (key.toLowerCase() === 'content-type') {
                body.contentType = event.headers[key];
                break;
            }
        }
        console.log('Discovered content type:', body.contentType);

        // decode the inbound body
        const baseContentType = body.contentType.split(';')[0];
        switch (baseContentType) {

        case 'multipart/form-data':
            // console.log(event.body);
            const boundary = body.contentType.match(/boundary=([^; ]+)/)[1];
            const {fields, files} = parseMultiPart(Buffer.from(event.body, 'base64'), boundary);
            // console.log({fields});
            body.payload = fields;
            // TODO: store the files into s3
            // const filePrefix = (fields['Message-Id'] || Math.random().toString(36).slice(2));
            body.payloadType = 'multipart-form';
            break;

        case 'application/x-www-form-urlencoded':
            const formData = querystring.parse(event.body);
            // detect an embedded json payload
            if (formData.payload && formData.payload[0] === '{') {
                body.payload = JSON.parse(formData.payload);
                body.payloadType = 'urlencoded-json';
            } else {
                // this shouldn't really be used, it's a fallback
                body.payload = formData;
                body.payloadType = 'urlencoded-form';
            }
            break;

        case 'application/json':
            body.payload = JSON.parse(event.body);
            body.payloadType = 'json';
            break;

            case 'text/plain':
                if (event.body[0] === '{') {
                    body.payload = JSON.parse(event.body);
                    body.payloadType = 'json';
                } else {
                    body.payload = {text: event.body};
                    body.payloadType = 'text';
                }
                break;

        default:
            throw new Error('Unsupported Content-Type: '+body.contentType);
        }

        console.log('Hook came from IP', sourceIp);
        console.log('Hook came from UA', userAgent);

        if (event.pathParameters) {
            body.hookFlavor = event.pathParameters.hook;
        } else {
            body.hookFlavor = event.resource.split('/')[2];
        }

        // route to an SQS queue
        const isOldHook = oldQueues.includes(body.hookFlavor);
        const messageReq = isOldHook ? {
            QueueUrl: queueBase + 'hooks-from-' + body.hookFlavor,
            MessageBody: JSON.stringify(body),
        } : {
            QueueUrl: queueBase + 'skyhook-webhook-inbound.fifo',
            MessageBody: JSON.stringify(body),
            // TODO: actual deduplication?
            MessageDeduplicationId: Math.random().toString().slice(2)+'-'+Date.now(),
            MessageGroupId: ['webhook', body.hookFlavor].map(encodeURIComponent).join('/')
        };
        console.log('Routing to SQSq', messageReq.QueueUrl.replace(queueBase, ''));

        // prepare placeholder response
        var response = {
            statusCode: 500,
            headers: {
                "content-type" : "text/plain",
            },
            body: 'im confused',
        };

        // actually store the message
        SQS.sendMessage(messageReq, (err, data) => {
            if (err) {
                if (err.code === "AWS.SimpleQueueService.NonExistentQueue") {
                    response.statusCode = 404;
                    response.body = "this webhook doesn't exist";
                    return callback(null, response);
                }

                // AWS stuff can always fail
                console.log('Failed to hit SQS :(', JSON.stringify(err, null, 2));
                return callback(err);
            }

            console.log('Hook stored in SQS :)');
            response.statusCode = 200;
            response.body = 'thx <3';
            callback(null, response);
        });

    } catch (err) {
        callback(err);
    }
};

// loosely based on https://github.com/freesoftwarefactory/parse-multipart/blob/master/multipart.js
function readSegment(str){
	var k = str.split('=');
	return [k[0].trim(), JSON.parse(k[1].trim())];
}
function parseMultiPart(multipartBodyBuffer,boundary){
	const fields = {};
	const files = [];

	var process = function(part){
		// console.log(part)
		const field = {...part.header};
		if (field.filename) {
			// field.name = field.name;
			field.headers = part.info;
			const data = Buffer.from(part.part);
			files.push({data, ...field});
			console.log(field);
// 			fields[field.name] = {filename: field.filename};
			fields[field.name] = field;
		} else {
			const rawText = Buffer.from(part.part).toString();
			if (field.name in fields) {
				if (fields[field.name].constructor !== Array)
					fields[field.name] = [fields[field.name]];
				fields[field.name].push(rawText);
			} else {
				fields[field.name] = rawText;
			}
		}
	}
	var prev = null;
	var lastline='';
	var header = '';
	var info = []; var state=0; var buffer=[];

	for(let i=0;i<multipartBodyBuffer.length;i++){
		var oneByte = multipartBodyBuffer[i];
		var prevByte = i > 0 ? multipartBodyBuffer[i-1] : null;
		var newLineDetected = ((oneByte == 0x0a) && (prevByte == 0x0d)) ? true : false;
		var newLineChar = ((oneByte == 0x0a) || (oneByte == 0x0d)) ? true : false;

		if(!newLineChar)
			lastline += String.fromCharCode(oneByte);

		if((0 == state) && newLineDetected){
			if(("--"+boundary) == lastline){
				state=1;
			}
			lastline='';
		}else
		if((1 == state) && newLineDetected){
			header = {};
			lastline
				.split(';').slice(1)
				.map(readSegment)
				.forEach(([k,v]) => header[k] = v);
			state=2;
			lastline='';
		}else
		if((2 == state) && newLineDetected){
			if (lastline.length > 0) {
				info.push(lastline.split(':').map(x => x.trim()));
				lastline='';
			} else {
				state=4;
				buffer=[];
				lastline='';
			}
		}else
		if(4 == state){
			if(lastline.length > (boundary.length+4)) lastline=''; // mem save
			if(((("--"+boundary) == lastline))){
				var j = buffer.length - lastline.length;
				var part = buffer.slice(0,j-1);
				var p = { header : header , info : info , part : part  };
				process(p);
				buffer = []; lastline=''; state=5; header=''; info=[];
			}else{
				buffer.push(oneByte);
			}
			if(newLineDetected) lastline='';
		}else
		if(5==state){
			if(newLineDetected)
				state=1;
		}
	}
	return {fields, files};
};
