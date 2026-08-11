import { verifySession } from '../../../libs/auth';
import { getUserById } from '../../../libs/db';

// GET /api/auth/me - Get current user
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const session = await verifySession(env, request);

  if (!session) {
    return Response.json({ user: null }, { status: 401 });
  }

  const user = await getUserById(env.DB, session.userId);

  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      credits: user.credits,
    },
  });
};
