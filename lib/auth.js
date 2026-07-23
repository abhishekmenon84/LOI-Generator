import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    // JWT (not database) strategy — Next.js Edge middleware can't run Prisma
    // queries, so database-strategy session lookups fail there, silently
    // treating logged-in users as logged-out.
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // refresh once per day of activity
  },
  callbacks: {
    async jwt({ token, trigger }) {
      if (token.sub && (trigger === "update" || token.activeOrgId === undefined)) {
        const membership = await prisma.membership.findFirst({
          where: { userId: token.sub, org: { isPersonal: true } },
          select: { orgId: true, role: true },
        });
        token.activeOrgId = membership?.orgId || null;
        token.orgRole = membership?.role || null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.activeOrgId = token.activeOrgId || null;
        session.user.orgRole = token.orgRole || null;
      }
      return session;
    },
  },
  providers: [
    {
      id: "resend",
      type: "email",
      name: "Email",
      from: "LOI Builder <onboarding@resend.dev>",
      maxAge: 60 * 10, // magic link valid for 10 minutes
      async sendVerificationRequest({ identifier: email, url }) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: "LOI Builder <onboarding@resend.dev>",
          to: email,
          subject: "Sign in to LOI Builder",
          html: `<p>Click the link below to sign in to LOI Builder. This link expires in 10 minutes.</p><p><a href="${url}">Sign in to LOI Builder</a></p>`,
        });
        if (error) {
          throw new Error(`Resend failed to send verification email: ${error.message}`);
        }
      },
    },
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
  },
});
