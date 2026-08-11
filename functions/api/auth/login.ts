import { createUser, getUserByEmail } from '../../../libs/db';
import { createSession } from '../../../libs/auth';
import { sendEmail } from '../../../libs/email';

// POST /api/auth/login - Email-based login (magic link)
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const { email } = await request.json();

  if (!email || !email.includes('@')) {
    return Response.json({ error: 'Valid email required' }, { status: 400 });
  }

  // Find or create user
  let user = await getUserByEmail(env.DB, email);
  if (!user) {
    user = await createUser(env.DB, { email });
  }

  // Create session
  const token = await createSession(env, user.id as number, email);

  // Send magic link email
  const magicLink = `${env.APP_URL}/auth/callback?token=${token}`;
  await sendEmail(env, {
    to: email,
    subject: 'Your TaleTok login link',
    html: `
      <h2>Welcome to TaleTok!</h2>
      <p>Click the link below to sign in:</p>
      <a href="${magicLink}" style="display:inline-block;padding:12px 24px;background:#8b5cf6;color:#fff;border-radius:8px;text-decoration:none;">Sign In</a>
      <p>This link expires in 7 days.</p>
    `,
  }).catch(() => {}); // Don't fail if email doesn't send in dev

  return Response.json({
    message: 'Check your email for a login link',
    dev_token: process.env.NODE_ENV === 'development' ? token : undefined,
  });
};
