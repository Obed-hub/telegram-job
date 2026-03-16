import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

export interface PaymentLinkParams {
  chatId: number;
  email: string;
  name: string;
  amount: number;
  currency: string;
}

export async function generatePaymentLink({ chatId, email, name, amount, currency }: PaymentLinkParams) {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) throw new Error('FLW_SECRET_KEY is missing');

  const payload = {
    tx_ref: `jobbot_${chatId}_${Date.now()}`,
    amount: amount.toString(),
    currency,
    redirect_url: 'https://t.me/CareerCupid_bot', // Use actual bot link
    customer: {
      email,
      name,
    },
    payment_options: 'card,ussd,mobilemoneyghana,mobilemoneyrwanda,mobilemoneyzambia,mobilemoneyuganda,banktransfer',
    customizations: {
      title: 'Job Matchmaker Pro',
      description: 'Unlock unlimited job alerts and AI features',
    },
  };

  console.log('Generating Payment Link via API:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post('https://api.flutterwave.com/v3/payments', payload, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('Flutterwave API Response:', JSON.stringify(response.data, null, 2));
    if (response.data.status === 'success') {
      return response.data.data.link;
    } else {
      throw new Error(response.data.message || 'Payment link generation failed');
    }
  } catch (error: any) {
    console.error('Flutterwave API Error:', {
      message: error.message,
      data: error.response?.data || error.data,
      status: error.response?.status
    });
    throw new Error(error.response?.data?.message || error.message);
  }
}

// Keep diagnostic function empty or minimal to avoid breaking bot.ts debug command
export function getFlw() {
  return { info: 'Switched to Axios for stability' };
}
