import { destroySession } from '../../../libs/auth';

// POST /api/auth/logout
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  await destroySession(env, request);

  return Response.json({ message: 'Logged out' }, {
    headers: {
      'Set-Cookie': 'auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
    },
  });
};
