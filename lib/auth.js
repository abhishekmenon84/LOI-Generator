import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import { prisma } from "./prisma";
import { renderEmail } from "./emailTemplate";

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
    {
      id: "resend",
      type: "email",
      name: "Email",
      from: "Ledgerlot <onboarding@resend.dev>",
      maxAge: 60 * 10, // magic link valid for 10 minutes
      async sendVerificationRequest({ identifier: email, url }) {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const { error } = await resend.emails.send({
          from: "Ledgerlot <onboarding@resend.dev>",
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
