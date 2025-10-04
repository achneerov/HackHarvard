require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const accountSid = process.env.TWILIO_ACCOUNT_SID || 'ACc24f15b82596a9e39f1630294cd45cc9';
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID || 'VA163284615acc138681ea5cec8ddf5d7b';

if (!authToken) {
  console.error('L Error: TWILIO_AUTH_TOKEN not found in environment variables');
  console.log('Please add TWILIO_AUTH_TOKEN to your .env file');
  process.exit(1);
}

const client = require('twilio')(accountSid, authToken);

// Change this to your phone number for testing
const TEST_PHONE_NUMBER = '+14385202457';

async function sendVerificationCode() {
  try {
    console.log('=ñ Sending verification code to', TEST_PHONE_NUMBER);
    console.log('Using Verify Service SID:', verifySid);

    const verification = await client.verify.v2
      .services(verifySid)
      .verifications
      .create({
        to: TEST_PHONE_NUMBER,
        channel: 'sms'
      });

    console.log(' Verification sent successfully!');
    console.log('Status:', verification.status);
    console.log('SID:', verification.sid);
    console.log('Channel:', verification.channel);
    console.log('\n=ì Check your phone for the verification code!');
    console.log('\nTo verify the code, run: node verify_sms_test.js <code>');
  } catch (error) {
    console.error('L Error sending verification:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.moreInfo) {
      console.error('More info:', error.moreInfo);
    }
  }
}

sendVerificationCode();
