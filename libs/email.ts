// Email sending via Resend (compatible with Cloudflare Workers)

export async function sendEmail(
  env: Env,
  params: { to: string; subject: string; html: string }
): Promise<any> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'noreply@taletok.app',
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Email send error:', error);
    throw new Error(`Failed to send email: ${response.statusText}`);
  }

  return response.json();
}
