import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { renderEmail } from "./emailTemplate";
import { EMAIL_FROM } from "./sendEmail";

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
  events: {
    // Fires exactly once, right after the Prisma adapter inserts a brand-new
    // User row -- the single place a personal org gets created for a new
    // signup now that /login no longer asks "Personal or Business" up
    // front. isPersonal orgs never went through a Stripe checkout, so
    // planTier starts at "free" (the pay-per-document tier, per
    // lib/orgBilling.js's pay-per-document Personal pricing).
    async createUser({ user }) {
      await prisma.organization.create({
        data: {
          name: "Personal",
          accountType: "individual",
          isPersonal: true,
          planTier: "free",
          memberships: { create: { userId: user.id, role: "admin" } },
        },
      });
    },
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
        // NextAuth's JWT callback already puts email/name/picture on the
        // token by default (from the User row at login) -- this callback
        // was overwriting session.user wholesale without forwarding them,
        // so session.user.email was silently undefined everywhere (every
        // "Signed in as {session.user.email}" display, every avatar
        // initial, and now also lib/platformAdmin.js's admin-email check).
        session.user.email = token.email || session.user.email || null;
      }
      return session;
    },
  },
  providers: [
    // Optional password sign-in, offered once a user has set a password
    // (see POST /api/users/me/password) -- until then this User has no
    // passwordHash and this provider always rejects them, so magic link
    // remains the only working method. Kept alongside the "resend" email
    // provider rather than replacing it: a forgotten password still has
    // an escape hatch, since there's no separate reset-password flow.
    Credentials({
      id: "password",
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
    {
      id: "resend",
      type: "email",
      name: "Email",
      from: EMAIL_FROM,
      maxAge: 60 * 10, // magic link valid for 10 minutes
      async sendVerificationRequest({ identifier: email, url }) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject: "Sign in to Ledgerlot",
          html: renderEmail({
            title: "Sign in to Ledgerlot",
            body: "Click the button below to securely sign in. This link expires in 10 minutes and can only be used once.",
            ctaLabel: "Sign in to Ledgerlot",
            ctaUrl: url,
            footerNote: "Didn't request this? You can safely ignore this email — no changes will be made to your account.",
          }),
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
