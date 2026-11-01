import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  const n = brand.legalName;
  return (
    <LegalPage
      current="privacy"
      title="Privacy policy"
      intro={`${n} (“we”, “us”) is a photo and video studio in ${brand.city}. This policy explains what we collect when you use our client delivery rooms at ${brand.siteUrl.replace("https://", "")}, and how we use it.`}
    >
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details.</strong> Your name, email address, and password (stored only as a secure hash) when you create an account with email.</li>
          <li><strong>Google sign-in.</strong> If you choose Continue with Google, Google shares your name, email address, and profile photo with us. We do not receive your Google password and we do not access your Gmail, Drive, contacts, or any other Google data.</li>
          <li><strong>Your activity in a room.</strong> Which rooms you open, the files you approve or ask changes on, comments you leave, and files you download, with the time each happened.</li>
          <li><strong>Basic technical data.</strong> Standard server logs such as IP address, browser type, and request times, kept by our hosting provider for security and troubleshooting.</li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To sign you in and show you every room we have delivered to you.</li>
          <li>To let our team see your approvals, change requests, and comments so we can finish your project.</li>
          <li>To keep the service secure and working.</li>
        </ul>
        <p>We do not sell your information, use it for advertising, or share it with anyone except the service providers listed below.</p>
      </section>

      <section>
        <h2>Google user data</h2>
        <p>
          We use the basic profile information Google provides (name, email address, profile photo) only to create and identify
          your account. We do not transfer it to third parties, use it for ads, or use it to train AI models. Our use of
          information received from Google APIs follows the{" "}
          <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including its Limited Use requirements.
        </p>
      </section>

      <section>
        <h2>Who processes it for us</h2>
        <ul>
          <li><strong>Supabase</strong> stores accounts, room activity, and the photos and videos we deliver.</li>
          <li><strong>Vercel</strong> hosts the website.</li>
          <li><strong>Google</strong>, only if you choose to sign in with Google.</li>
        </ul>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>We use only the cookies needed to keep you signed in. We do not use advertising or tracking cookies.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep your account and room activity while you are a client, and delivered files for as long as the room is
          active. You can ask us to delete your account and activity at any time, and we will do so within 30 days, except
          where we must keep records for legal or billing reasons.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You can ask to see, correct, or delete your information, or to close your account, by contacting {n}. If you live
          in California, you also have the rights described in the California Consumer Privacy Act, and we will not treat
          you differently for using them.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>Our service is for businesses and adults. We do not knowingly collect information from children under 13.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If we change this policy, we will update the date at the top of this page.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about privacy? Reach {n} in {brand.city} through the contact details on your project paperwork or the
          message that delivered your room link. See also our <Link href="/terms">Terms of Service</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
