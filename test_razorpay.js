import dotenv from 'dotenv';
import Razorpay from 'razorpay';

dotenv.config();

async function testRazorpay() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  console.log('Testing Razorpay key presence:', Boolean(key_id), Boolean(key_secret));

  try {
    const rzp = new Razorpay({ key_id, key_secret });
    const order = await rzp.orders.create({
      amount: 8000 * 100, // 8000 INR in paise
      currency: 'INR',
      receipt: `test_rcpt_${Date.now()}`,
      notes: {
        source: 'sentinel_v4_test',
        agentId: 'relief_agent_001',
      },
    });
    console.log('✅ Razorpay Test Order Created Successfully:');
    console.log('Order ID:', order.id);
    console.log('Amount:', order.amount);
    console.log('Currency:', order.currency);
    console.log('Status:', order.status);
  } catch (err) {
    console.log('❌ Razorpay error:', err.message);
  }
}

testRazorpay();
