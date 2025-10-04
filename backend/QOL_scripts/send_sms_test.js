require('dotenv').config({ path: require('path').join(__dirname, '../../', '.env') });
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const toNumber = process.env.TEST_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

client.messages
  .create({
    body: 'Hello World!',
    from: fromNumber,
    to: toNumber
  })
  .then(message => {
    console.log('Message sent successfully!');
    console.log('SID:', message.sid);
  })
  .catch(error => {
    console.error('Error sending message:', error);
  });
